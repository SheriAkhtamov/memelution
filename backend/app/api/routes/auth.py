from __future__ import annotations

from base64 import b64encode
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_oidc_state,
    create_session_for_user,
    decode_token,
    decode_oidc_state,
    ensure_username_available,
    generate_nonce,
    generate_pkce_pair,
    get_current_user,
    validate_username,
    verify_telegram_id_token,
    verify_telegram_payload,
)
from app.core.config import settings
from app.db.session import get_session
from app.models import (
    Session, User,
)
from app.schemas import (
    AdminLoginPayload, AuthPayload,
)
from app.services.api_support import *  # noqa: F403

router = APIRouter()

@router.post("/api/auth/dev-login")
async def dev_login(payload: AuthPayload, request: Request, db: AsyncSession = Depends(get_session)):
    if not settings.enable_dev_auth:
        raise HTTPException(status_code=403, detail="Dev auth is disabled")
    if settings.environment not in ("development", "test"):
        raise HTTPException(status_code=403, detail="Dev auth is disabled outside development")
    telegram_id = str(payload.telegram_id or payload.id or "123")
    username = validate_username(payload.username or f"user_{telegram_id}")
    user = await db.scalar(select(User).where(User.telegram_id == telegram_id))
    if not user:
        username = await ensure_username_available(db, username)
        user = User(
            telegram_id=telegram_id,
            username=username,
            display_name=(payload.first_name or payload.username or "Новый пользователь").strip(),
            avatar_url=payload.photo_url,
            onboarding_completed=False,
        )
        db.add(user)
        await db.flush()
    token, session = await create_session_for_user(db, request, user)
    await db.commit()
    return {"token": token, "session_id": session.id, "user": user_public(user, full=True)}




@router.post("/api/auth/admin-login")
async def admin_login(payload: AdminLoginPayload, request: Request, db: AsyncSession = Depends(get_session)):
    if not settings.admin_login or not settings.admin_password:
        raise HTTPException(status_code=503, detail="Admin login is not configured")
    if payload.login != settings.admin_login or payload.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    username = payload.login.strip().lower()
    user = await db.scalar(select(User).where(User.username == username))
    if not user:
        user = User(
            username=username,
            display_name=payload.login,
            role="global_admin",
            onboarding_completed=True,
            bio="Администратор платформы",
        )
        db.add(user)
        await db.flush()
    else:
        user.role = "global_admin"
        user.onboarding_completed = True
    token, session = await create_session_for_user(db, request, user)
    await db.commit()
    return {"token": token, "session_id": session.id, "user": user_public(user, full=True)}




@router.get("/api/auth/telegram/start")
async def telegram_oidc_start(redirect_to: str = "/"):
    if not settings.telegram_client_id or not settings.telegram_client_secret:
        raise HTTPException(status_code=503, detail="Telegram OIDC client is not configured")
    code_verifier, code_challenge = generate_pkce_pair()
    nonce = generate_nonce()
    state = await create_oidc_state(code_verifier, nonce, safe_redirect_to(redirect_to))
    params = {
        "client_id": str(settings.telegram_client_id),
        "redirect_uri": telegram_redirect_uri(),
        "response_type": "code",
        "scope": "openid profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return RedirectResponse(f"https://oauth.telegram.org/auth?{urlencode(params)}", status_code=302)




@router.get("/api/auth/telegram/callback")
async def telegram_oidc_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_session),
):
    if error:
        return RedirectResponse(f"{settings.app_url.rstrip('/')}/login?{urlencode({'error': error})}")
    if not code or not state:
        raise HTTPException(status_code=422, detail="Missing OIDC code or state")
    state_payload = await decode_oidc_state(state)
    basic = b64encode(f"{settings.telegram_client_id}:{settings.telegram_client_secret}".encode()).decode()
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            "https://oauth.telegram.org/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": telegram_redirect_uri(),
                "client_id": str(settings.telegram_client_id),
                "code_verifier": state_payload["code_verifier"],
            },
            headers={
                "Authorization": f"Basic {basic}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=401, detail=f"Telegram token exchange failed: {response.text}")
    token_data = response.json()
    id_token = token_data.get("id_token")
    if not id_token:
        raise HTTPException(status_code=401, detail="Telegram did not return an ID token")
    claims = verify_telegram_id_token(id_token, state_payload.get("nonce"))
    telegram_id = str(claims.get("sub") or claims.get("id"))
    if not telegram_id:
        raise HTTPException(status_code=401, detail="Telegram ID token has no subject")
    user = await db.scalar(select(User).where(User.telegram_id == telegram_id))
    if not user:
        username = await unique_username_from_telegram(db, claims.get("preferred_username"), telegram_id)
        user = User(
            telegram_id=telegram_id,
            username=username,
            display_name=claims.get("name") or username,
            avatar_url=claims.get("picture"),
            onboarding_completed=False,
        )
        db.add(user)
        await db.flush()
    else:
        user.display_name = claims.get("name") or user.display_name
        user.avatar_url = claims.get("picture") or user.avatar_url
    token, session = await create_session_for_user(db, request, user)
    await db.commit()
    redirect_to = safe_redirect_to(state_payload.get("redirect_to"))
    frontend_callback = f"{settings.app_url.rstrip('/')}/auth/callback"
    redirect_response = RedirectResponse(f"{frontend_callback}#{urlencode({'token': token, 'redirect_to': redirect_to})}", status_code=302)
    redirect_response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
        max_age=settings.access_token_minutes * 60,
        path="/",
    )
    return redirect_response




@router.post("/api/auth/telegram")
async def telegram_login(payload: AuthPayload, request: Request, db: AsyncSession = Depends(get_session)):
    data = payload.model_dump(exclude_none=True)
    if not verify_telegram_payload(data):
        raise HTTPException(status_code=401, detail="Invalid Telegram signature")
    telegram_id = str(payload.telegram_id or payload.id)
    if not telegram_id:
        raise HTTPException(status_code=422, detail="Telegram id is required")
    user = await db.scalar(select(User).where(User.telegram_id == telegram_id))
    if not user:
        base_username = payload.username or f"tg_{telegram_id}"
        username = await ensure_username_available(db, base_username)
        name = " ".join(part for part in [payload.first_name, payload.last_name] if part).strip()
        user = User(
            telegram_id=telegram_id,
            username=username,
            display_name=name or username,
            avatar_url=payload.photo_url,
            onboarding_completed=False,
        )
        db.add(user)
        await db.flush()
    token, session = await create_session_for_user(db, request, user)
    await db.commit()
    return {"token": token, "session_id": session.id, "user": user_public(user, full=True)}




@router.post("/api/auth/logout")
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    auth = request.headers.get("authorization", "")
    token = auth.replace("Bearer ", "")
    payload = decode_token(token)
    session = await db.get(Session, payload.get("sid"))
    if session and session.user_id == user.id:
        session.is_revoked = True
    await db.commit()
    return {"success": True}




@router.get("/api/auth/sessions")
async def sessions(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    rows = (
        await db.scalars(select(Session).where(Session.user_id == user.id).order_by(desc(Session.created_at)))
    ).all()
    return [
        {
            "id": row.id,
            "user_agent": row.user_agent,
            "ip_address": row.ip_address,
            "is_revoked": row.is_revoked,
            "created_at": row.created_at.isoformat(),
            "expires_at": row.expires_at.isoformat(),
        }
        for row in rows
    ]




@router.delete("/api/auth/sessions")
async def revoke_sessions(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    rows = (await db.scalars(select(Session).where(Session.user_id == user.id))).all()
    for row in rows:
        row.is_revoked = True
    await db.commit()
    return {"success": True}


