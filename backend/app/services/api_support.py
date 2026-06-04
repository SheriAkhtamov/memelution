from __future__ import annotations

import json
import re
import secrets
from base64 import b64decode, b64encode
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ensure_username_available, require_admin, validate_username
from app.core.config import settings
from app.models import (
    Comment,
    CommentReaction,
    Community,
    CommunityMember,
    Hashtag,
    Like,
    Notification,
    PollVote,
    Post,
    PostHashtag,
    Reaction,
    Repost,
    Save,
    SaveCollection,
    User,
)
from app.services.realtime import manager


def error_code(message: str | None, status_code: int) -> str:
    if not message:
        return f"HTTP_{status_code}"
    code = re.sub(r"[^a-zA-Z0-9]+", "_", message).strip("_").upper()
    return code[:60] or f"HTTP_{status_code}"


def api_error_response(
    message: str,
    status_code: int,
    *,
    code: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    return {
        "error": {
            "code": code or error_code(message, status_code),
            "message": message,
            "details": details or {},
        }
    }


def absolutize(url: str | None) -> str | None:
    if not url:
        return url
    if url.startswith("/media/"):
        return f"{settings.api_url.rstrip('/')}{url}"
    return url


def user_public(user: User | None, full: bool = False) -> dict[str, Any] | None:
    if not user:
        return None
    data = {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": absolutize(user.avatar_url),
        "cover_url": absolutize(user.cover_url),
        "bio": user.bio,
        "website": user.website,
        "language": user.language,
        "role": user.role,
        "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat(),
        "followers_count": user.followers_count,
        "following_count": user.following_count,
        "posts_count": user.posts_count,
        "onboarding_completed": user.onboarding_completed,
        "interests": user.interests,
        "location": user.location,
    }
    if full:
        data.update(
            {
                "telegram_id": user.telegram_id,
                "privacy": user.privacy,
                "notification_settings": user.notification_settings,
                "is_banned": user.is_banned,
                "banned_until": user.banned_until.isoformat() if user.banned_until else None,
                "ban_reason": user.ban_reason,
                "restrictions": user.restrictions or {},
            }
        )
    return data


def community_public(community: Community | None) -> dict[str, Any] | None:
    if not community:
        return None
    return {
        "id": community.id,
        "owner_id": community.owner_id,
        "name": community.name,
        "slug": community.slug,
        "description": community.description,
        "avatar_url": absolutize(community.avatar_url),
        "cover_url": absolutize(community.cover_url),
        "category_id": community.category_id,
        "type": community.type,
        "language": community.language,
        "rules": community.rules,
        "settings": community.settings,
        "members_count": community.members_count,
        "posts_count": community.posts_count,
        "is_banned": community.is_banned,
        "created_at": community.created_at.isoformat(),
    }


def telegram_redirect_uri() -> str:
    if settings.telegram_redirect_uri:
        return settings.telegram_redirect_uri
    return f"{settings.api_url.rstrip('/')}/api/auth/telegram/callback"


def safe_redirect_to(value: str | None) -> str:
    if not value:
        return "/"
    value = value.strip()
    if not value.startswith("/") or value.startswith("//"):
        return "/"
    if "\\n" in value or "\\r" in value or "\n" in value or "\r" in value:
        return "/"
    if "://" in value:
        return "/"
    if value.startswith("/\\"):
        return "/"
    return value[:256] if len(value) > 256 else value


def health_status() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


def ensure_not_restricted(user: User, permission: str) -> None:
    if user.role in {"global_admin", "admin"}:
        return
    restrictions = user.restrictions or {}
    if restrictions.get(permission):
        raise HTTPException(status_code=403, detail=f"User is restricted from {permission}")


def require_global_admin(user: User = Depends(require_admin)) -> User:
    if user.role != "global_admin":
        raise HTTPException(status_code=403, detail="Global admin role required")
    return user


async def unique_community_slug(db: AsyncSession, value: str | None, current_community_id: str | None = None) -> str:
    if value and value.strip():
        slug = validate_username(value.replace("-", "_")).replace("_", "-")
        existing = await db.scalar(select(Community).where(Community.slug == slug))
        if existing and existing.id != current_community_id:
            raise HTTPException(status_code=409, detail="Community username is already taken")
        return slug
    while True:
        slug = f"community-{secrets.token_hex(4)}"
        existing = await db.scalar(select(Community).where(Community.slug == slug))
        if not existing:
            return slug


async def unique_username_from_telegram(db: AsyncSession, preferred: str | None, telegram_id: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9._]", "_", (preferred or f"tg_{telegram_id}").strip().lower())
    if len(base) < 3:
        base = f"tg_{telegram_id}"
    base = base[:24]
    candidate = base
    counter = 1
    for _ in range(50):
        try:
            return await ensure_username_available(db, candidate)
        except HTTPException as exc:
            if exc.status_code not in {409, 422}:
                raise
            suffix = f"_{counter}"
            candidate = f"{base[:30 - len(suffix)]}{suffix}"
            counter += 1
    return await ensure_username_available(db, f"user_{secrets.token_hex(4)}")


def encode_cursor(payload: dict[str, Any] | None) -> str | None:
    if not payload:
        return None
    safe = {}
    for key, value in payload.items():
        safe[key] = value.isoformat() if isinstance(value, datetime) else value
    return b64encode(json.dumps(safe, separators=(",", ":")).encode()).decode()


def decode_cursor(cursor: str | None) -> dict[str, Any]:
    if not cursor:
        return {}
    try:
        payload = json.loads(b64decode(cursor.encode()).decode())
        return payload if isinstance(payload, dict) else {}
    except (ValueError, TypeError, json.JSONDecodeError):
        return {}


def parse_cursor_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def engagement_score_value(post: Post) -> int:
    return int(post.likes_count or 0) + int(post.comments_count or 0) * 2 + int(post.reposts_count or 0) * 3 + int(post.saves_count or 0) * 3


def cursor_for_post(post: Post, include_score: bool = False) -> dict[str, Any]:
    payload: dict[str, Any] = {"created_at": post.created_at, "id": post.id}
    if include_score:
        payload["score"] = engagement_score_value(post)
    return payload


def apply_desc_cursor(query, model, cursor: str | None, score_expr=None):
    payload = decode_cursor(cursor)
    created_at = parse_cursor_datetime(payload.get("created_at"))
    item_id = payload.get("id")
    if not created_at or not item_id:
        return query
    base = or_(model.created_at < created_at, and_(model.created_at == created_at, model.id < str(item_id)))
    if score_expr is not None and payload.get("score") is not None:
        try:
            score = int(payload["score"])
        except (TypeError, ValueError):
            return query.where(base)
        return query.where(or_(score_expr < score, and_(score_expr == score, base)))
    return query.where(base)


def apply_asc_cursor(query, model, cursor: str | None):
    payload = decode_cursor(cursor)
    created_at = parse_cursor_datetime(payload.get("created_at"))
    item_id = payload.get("id")
    if not created_at or not item_id:
        return query
    return query.where(or_(model.created_at > created_at, and_(model.created_at == created_at, model.id > str(item_id))))


async def viewer_flags(db: AsyncSession, post_id: str, viewer: User | None) -> dict[str, bool]:
    if not viewer:
        return {"liked": False, "saved": False, "reposted": False}
    liked = await db.scalar(
        select(Like).where(Like.user_id == viewer.id, Like.target_type == "post", Like.target_id == post_id)
    )
    saved = await db.scalar(select(Save).where(Save.user_id == viewer.id, Save.post_id == post_id))
    reposted = await db.scalar(select(Repost).where(Repost.user_id == viewer.id, Repost.post_id == post_id))
    return {"liked": bool(liked), "saved": bool(saved), "reposted": bool(reposted)}


def _media_items(post: Post) -> list[dict[str, Any]]:
    items = list(post.media_items or [])
    if items:
        return [{**item, "url": absolutize(item.get("url"))} for item in items]
    if post.media_url:
        return [
            {
                "id": post.id,
                "url": absolutize(post.media_url),
                "type": post.media_type,
                "alt": post.media_alt,
            }
        ]
    return []


async def posts_public(db: AsyncSession, posts: list[Post], viewer: User | None = None) -> list[dict[str, Any]]:
    if not posts:
        return []
    author_ids = {post.author_id for post in posts}
    community_ids = {post.community_id for post in posts if post.community_id}
    post_ids = [post.id for post in posts]
    authors = {
        user.id: user
        for user in (await db.scalars(select(User).where(User.id.in_(author_ids)))).all()
    }
    communities = {}
    if community_ids:
        communities = {
            community.id: community
            for community in (await db.scalars(select(Community).where(Community.id.in_(community_ids)))).all()
        }
    liked_ids: set[str] = set()
    saved_ids: set[str] = set()
    reposted_ids: set[str] = set()
    votes: dict[str, str] = {}
    if viewer:
        liked_ids = set(
            (
                await db.scalars(
                    select(Like.target_id).where(
                        Like.user_id == viewer.id,
                        Like.target_type == "post",
                        Like.target_id.in_(post_ids),
                    )
                )
            ).all()
        )
        saved_ids = set((await db.scalars(select(Save.post_id).where(Save.user_id == viewer.id, Save.post_id.in_(post_ids)))).all())
        reposted_ids = set(
            (await db.scalars(select(Repost.post_id).where(Repost.user_id == viewer.id, Repost.post_id.in_(post_ids)))).all()
        )
        votes = {
            vote.post_id: vote.option_id
            for vote in (await db.scalars(select(PollVote).where(PollVote.user_id == viewer.id, PollVote.post_id.in_(post_ids)))).all()
        }

    # Reactions: grouped by (post_id, emoji) with counts
    reaction_rows = (await db.execute(
        select(Reaction.post_id, Reaction.emoji, func.count(Reaction.id).label("cnt"))
        .where(Reaction.post_id.in_(post_ids))
        .group_by(Reaction.post_id, Reaction.emoji)
    )).all()
    reactions_map: dict[str, list[dict[str, Any]]] = {}
    for row in reaction_rows:
        reactions_map.setdefault(row.post_id, []).append({"emoji": row.emoji, "count": row.cnt, "reacted": False})
    if viewer:
        viewer_reactions = (
            await db.scalars(select(Reaction).where(Reaction.user_id == viewer.id, Reaction.post_id.in_(post_ids)))
        ).all()
        viewer_reaction_set = {(r.post_id, r.emoji) for r in viewer_reactions}
        for pid, items in reactions_map.items():
            for item in items:
                if (pid, item["emoji"]) in viewer_reaction_set:
                    item["reacted"] = True

    result: list[dict[str, Any]] = []
    for post in posts:
        total_votes = sum(int(option.get("votes", 0)) for option in (post.poll_options or []))
        voted_option_id = votes.get(post.id)
        poll_settings = post.poll_settings or {}
        results_mode = poll_settings.get("results", "after_vote")
        poll_results_visible = bool(results_mode == "always" or voted_option_id or (viewer and viewer.id == post.author_id))
        result.append(
            {
                "id": post.id,
                "author_id": post.author_id,
                "community_id": post.community_id,
                "parent_post_id": post.parent_post_id,
                "type": post.type,
                "text": post.text,
                "media_url": absolutize(post.media_url),
                "media_type": post.media_type,
                "media_alt": post.media_alt,
                "media_items": _media_items(post),
                "poll_options": post.poll_options,
                "poll_settings": poll_settings,
                "poll_total_votes": total_votes,
                "poll_voted_option_id": voted_option_id,
                "poll_results_visible": poll_results_visible,
                "visibility": post.visibility,
                "status": post.status,
                "comments_enabled": post.comments_enabled,
                "is_pinned": post.is_pinned,
                "likes_count": post.likes_count,
                "comments_count": post.comments_count,
                "reposts_count": post.reposts_count,
                "saves_count": post.saves_count,
                "created_at": post.created_at.isoformat(),
                "updated_at": post.updated_at.isoformat(),
                "author": user_public(authors.get(post.author_id)),
                "community": community_public(communities.get(post.community_id)) if post.community_id else None,
                "liked": post.id in liked_ids,
                "saved": post.id in saved_ids,
                "reposted": post.id in reposted_ids,
                "reactions": reactions_map.get(post.id, []),
            }
        )
    return result


async def post_public(db: AsyncSession, post: Post, viewer: User | None = None) -> dict[str, Any]:
    return (await posts_public(db, [post], viewer))[0]


async def comments_public(db: AsyncSession, comments: list[Comment], viewer: User | None = None) -> list[dict[str, Any]]:
    if not comments:
        return []
    author_ids = {comment.author_id for comment in comments}
    comment_ids = [comment.id for comment in comments]
    authors = {
        user.id: user
        for user in (await db.scalars(select(User).where(User.id.in_(author_ids)))).all()
    }
    liked_ids: set[str] = set()
    if viewer:
        liked_ids = set(
            (
                await db.scalars(
                    select(Like.target_id).where(
                        Like.user_id == viewer.id,
                        Like.target_type == "comment",
                        Like.target_id.in_(comment_ids),
                    )
                )
            ).all()
        )
    reaction_rows = (
        await db.execute(
            select(CommentReaction.comment_id, CommentReaction.emoji, func.count(CommentReaction.id).label("cnt"))
            .where(CommentReaction.comment_id.in_(comment_ids))
            .group_by(CommentReaction.comment_id, CommentReaction.emoji)
        )
    ).all()
    reactions_map: dict[str, list[dict[str, Any]]] = {}
    for row in reaction_rows:
        reactions_map.setdefault(row.comment_id, []).append(
            {"emoji": row.emoji, "count": row.cnt, "reacted": False}
        )
    if viewer:
        viewer_reactions = (
            await db.scalars(
                select(CommentReaction).where(
                    CommentReaction.user_id == viewer.id,
                    CommentReaction.comment_id.in_(comment_ids),
                )
            )
        ).all()
        viewer_reaction_set = {(reaction.comment_id, reaction.emoji) for reaction in viewer_reactions}
        for comment_id, items in reactions_map.items():
            for item in items:
                if (comment_id, item["emoji"]) in viewer_reaction_set:
                    item["reacted"] = True
    return [
        {
            "id": comment.id,
            "post_id": comment.post_id,
            "author_id": comment.author_id,
            "parent_comment_id": comment.parent_comment_id,
            "text": "" if comment.is_deleted else comment.text,
            "likes_count": comment.likes_count,
            "is_deleted": comment.is_deleted,
            "hidden_by_moderator": comment.hidden_by_moderator,
            "created_at": comment.created_at.isoformat(),
            "updated_at": comment.updated_at.isoformat(),
            "author": user_public(authors.get(comment.author_id)),
            "liked": comment.id in liked_ids,
            "reactions": reactions_map.get(comment.id, []),
            "replies": [],
        }
        for comment in comments
    ]


async def comment_public(db: AsyncSession, comment: Comment, viewer: User | None = None) -> dict[str, Any]:
    return (await comments_public(db, [comment], viewer))[0]


async def notify(db: AsyncSession, user_id: str, type_: str, data: dict[str, Any]) -> Notification:
    notification = Notification(user_id=user_id, type=type_, data=data)
    db.add(notification)
    await db.flush()
    payload = {
        "id": notification.id,
        "type": notification.type,
        "data": notification.data,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat(),
    }
    try:
        await manager.send(user_id, {"event": "notification", "notification": payload})
    except Exception:
        pass
    return notification


async def collection_public(db: AsyncSession, collection: SaveCollection, viewer: User | None = None) -> dict[str, Any]:
    count = await db.scalar(select(func.count(Save.id)).where(Save.collection_id == collection.id))
    return {
        "id": collection.id,
        "user_id": collection.user_id,
        "name": collection.name,
        "title": collection.name,
        "description": collection.description,
        "visibility": collection.visibility,
        "sort_order": collection.sort_order,
        "posts_count": count or 0,
        "created_at": collection.created_at.isoformat(),
        "updated_at": collection.updated_at.isoformat(),
        "editable": bool(viewer and viewer.id == collection.user_id),
    }


HASHTAG_RE = re.compile(r"#([\wа-яА-ЯёЁ_]{2,80})", re.UNICODE)


async def sync_hashtags(db: AsyncSession, post: Post) -> None:
    names = {match.group(1).lower() for match in HASHTAG_RE.finditer(post.text or "")}
    if not names:
        return
    for name in names:
        tag = await db.scalar(select(Hashtag).where(Hashtag.name == name))
        if not tag:
            tag = Hashtag(name=name, posts_count=0)
            db.add(tag)
            await db.flush()
        existing = await db.scalar(select(PostHashtag).where(PostHashtag.post_id == post.id, PostHashtag.hashtag_id == tag.id))
        if not existing:
            db.add(PostHashtag(post_id=post.id, hashtag_id=tag.id))
            tag.posts_count += 1


async def require_community_manager(db: AsyncSession, community_id: str, user: User) -> CommunityMember:
    if user.role == "global_admin":
        return CommunityMember(community_id=community_id, user_id=user.id, role="admin", status="active")
    member = await db.scalar(
        select(CommunityMember).where(
            CommunityMember.community_id == community_id,
            CommunityMember.user_id == user.id,
            CommunityMember.status == "active",
        )
    )
    if not member or member.role not in {"creator", "admin", "moderator"}:
        raise HTTPException(status_code=403, detail="Community moderator role required")
    return member


async def comments_for_post(
    post_id: str,
    sort: str,
    limit: int,
    cursor: str | None,
    db: AsyncSession,
    viewer: User | None,
) -> dict[str, Any]:
    score_expr = Comment.likes_count if sort == "popular" else None
    if sort == "old":
        query = select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at.asc(), Comment.id.asc())
        query = apply_asc_cursor(query, Comment, cursor)
    elif sort == "popular":
        query = (
            select(Comment)
            .where(Comment.post_id == post_id)
            .order_by(desc(Comment.likes_count), desc(Comment.created_at), desc(Comment.id))
        )
        query = apply_desc_cursor(query, Comment, cursor, score_expr=score_expr)
    else:
        query = select(Comment).where(Comment.post_id == post_id).order_by(desc(Comment.created_at), desc(Comment.id))
        query = apply_desc_cursor(query, Comment, cursor)
    rows = (await db.scalars(query.limit(limit + 1))).all()
    page_rows = rows[:limit]
    items = await comments_public(db, page_rows, viewer)
    by_id = {item["id"]: item for item in items}
    roots = []
    for item in items:
        parent_id = item["parent_comment_id"]
        if parent_id and parent_id in by_id:
            by_id[parent_id]["replies"].append(item)
        else:
            roots.append(item)
    last = page_rows[-1] if page_rows else None
    next_payload = None
    if last and len(rows) > limit:
        next_payload = {"created_at": last.created_at, "id": last.id}
        if score_expr is not None:
            next_payload["score"] = last.likes_count
    return {"items": roots, "next_cursor": encode_cursor(next_payload), "has_more": len(rows) > limit}
