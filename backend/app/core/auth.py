from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.models import Session, User, now

bearer = HTTPBearer(auto_error=False)
USERNAME_RE = re.compile(r"^[a-zA-Z0-9._]{3,30}$")
RESERVED_USERNAMES = {"admin", "support", "moderator", "root", "system", "api", "telegram"}
_oidc_state_store: dict[str, dict[str, Any]] = {}


def validate_username(username: str) -> str:
    value = username.strip().lstrip("@").lower()
    if not USERNAME_RE.match(value):
        raise HTTPException(status_code=422, detail="Username must be 3-30 latin chars, digits, dot or underscore")
    if value in RESERVED_USERNAMES:
        raise HTTPException(status_code=422, detail="This username is reserved")
    return value


def create_access_token(user_id: str, session_id: str, expires_delta: timedelta) -> str:
    expires_at = now() + expires_delta
    return jwt.encode(
        {"sub": user_id, "sid": session_id, "exp": int(expires_at.timestamp())},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


async def _get_redis():
    from app.services.realtime import manager
    await manager.ensure_redis()
    return manager.redis


async def create_oidc_state(code_verifier: str, nonce: str, redirect_to: str | None = None) -> str:
    current = now()
    state = secrets.token_urlsafe(32)
    payload = {
        "code_verifier": code_verifier,
        "nonce": nonce,
        "redirect_to": redirect_to or "/",
        "expires_at": (current + timedelta(minutes=10)).isoformat(),
    }
    try:
        redis = await _get_redis()
        if redis:
            await redis.setex(f"oidc:state:{state}", 600, __import__("json").dumps(payload))
            return state
    except Exception:
        pass
    for key, val in list(_oidc_state_store.items()):
        if val["expires_at"] <= current:
            _oidc_state_store.pop(key, None)
    _oidc_state_store[state] = {**payload, "expires_at": current + timedelta(minutes=10)}
    return state


async def decode_oidc_state(state: str) -> dict[str, Any]:
    payload = None
    try:
        redis = await _get_redis()
        if redis:
            raw = await redis.getdel(f"oidc:state:{state}")
            if raw:
                payload = __import__("json").loads(raw)
    except Exception:
        pass
    if not payload:
        payload = _oidc_state_store.pop(state, None)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid OIDC state")
    exp = payload["expires_at"]
    if isinstance(exp, str):
        exp = __import__("datetime").datetime.fromisoformat(exp)
    if exp <= now():
        raise HTTPException(status_code=401, detail="Invalid OIDC state")
    return payload


def generate_pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = jwt.utils.base64url_encode(digest).decode()
    return verifier, challenge


def generate_nonce() -> str:
    return secrets.token_urlsafe(32)


def verify_telegram_id_token(id_token: str, nonce: str | None = None) -> dict[str, Any]:
    if not settings.telegram_client_id:
        raise HTTPException(status_code=503, detail="Telegram OIDC client is not configured")
    try:
        jwks_client = jwt.PyJWKClient("https://oauth.telegram.org/.well-known/jwks.json")
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256", "ES256", "EdDSA"],
            audience=str(settings.telegram_client_id),
            issuer="https://oauth.telegram.org",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Telegram ID token") from exc
    if nonce and claims.get("nonce") not in {None, nonce}:
        raise HTTPException(status_code=401, detail="Invalid Telegram nonce")
    return claims


def verify_telegram_payload(payload: dict[str, Any]) -> bool:
    if payload.get("dev"):
        if not settings.enable_dev_auth:
            raise HTTPException(status_code=403, detail="Dev auth is disabled")
        if settings.environment not in ("development", "test"):
            raise HTTPException(status_code=403, detail="Dev auth is only allowed in dev environment")
        return True
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=503, detail="Telegram bot token is not configured")
    received_hash = payload.get("hash")
    if not received_hash:
        raise HTTPException(status_code=401, detail="Missing Telegram hash")
    data_check = "\n".join(
        f"{key}={value}" for key, value in sorted(payload.items()) if key != "hash" and value is not None
    )
    secret = hashlib.sha256(settings.telegram_bot_token.encode()).digest()
    expected_hash = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_hash, received_hash)


async def create_session_for_user(db: AsyncSession, request: Request, user: User) -> tuple[str, Session]:
    expires_at = now() + timedelta(minutes=settings.access_token_minutes)
    session = Session(
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()
    token = create_access_token(user.id, session.id, expires_at - now())
    return token, session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_session),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    session_id = payload.get("sid")
    if not user_id or not session_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    session = await db.get(Session, session_id)
    if not session or session.is_revoked or session.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")
    if user.is_banned:
        banned_until = user.banned_until
        if banned_until and banned_until.tzinfo is None:
            banned_until = banned_until.replace(tzinfo=timezone.utc)
        if banned_until and banned_until <= now():
            user.is_banned = False
            user.banned_until = None
            user.ban_reason = None
            await db.commit()
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User unavailable")
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_session),
) -> User | None:
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in {"global_admin", "admin"}:
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


async def ensure_username_available(db: AsyncSession, username: str, current_user_id: str | None = None) -> str:
    value = validate_username(username)
    existing = await db.scalar(select(User).where(User.username == value))
    if existing and existing.id != current_user_id:
        raise HTTPException(status_code=409, detail="Username is already taken")
    return value
