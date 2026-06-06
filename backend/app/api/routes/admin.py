from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_user,
    require_admin,
)
from app.core.config import settings
from app.db.session import get_session
from app.models import (
    Comment, Community, CommunityMember,
    Hashtag, ModerationLog,
    Post, PostHashtag, Report, Session, User, now,
)
from app.schemas import (
    AdminModerationPayload, AdminRolePayload, ReportPayload, ResolveReportPayload,
)
from app.services.api_support import *  # noqa: F403

router = APIRouter()

# Track app start time for uptime calculation
_app_start_time = datetime.now(timezone.utc)

@router.post("/api/reports")
async def create_report(
    payload: ReportPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    target_model = {
        "post": Post,
        "comment": Comment,
        "user": User,
        "community": Community,
    }[payload.target_type]
    if not await db.get(target_model, payload.target_id):
        raise HTTPException(status_code=404, detail="Report target not found")

    report = Report(
        reporter_id=user.id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason=payload.reason,
        description=payload.description,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return {
        "id": report.id,
        "target_type": report.target_type,
        "target_id": report.target_id,
        "reason": report.reason,
        "status": report.status,
        "created_at": report.created_at.isoformat(),
    }




@router.get("/api/reports/my")
async def my_reports(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    rows = (await db.scalars(select(Report).where(Report.reporter_id == user.id).order_by(desc(Report.created_at)))).all()
    return [
        {
            "id": item.id,
            "target_type": item.target_type,
            "target_id": item.target_id,
            "reason": item.reason,
            "description": item.description,
            "status": item.status,
            "created_at": item.created_at.isoformat(),
            "resolved_at": item.resolved_at.isoformat() if item.resolved_at else None,
        }
        for item in rows
    ]




@router.get("/api/admin/stats")
async def admin_stats(db: AsyncSession = Depends(get_session), user: User = Depends(require_admin)):
    week_ago = now() - timedelta(days=7)
    month_ago = now() - timedelta(days=30)
    open_reports = await db.scalar(select(func.count(Report.id)).where(Report.status.in_(("open", "pending"))))
    active_users = await db.scalar(
        select(func.count(func.distinct(Session.user_id))).where(
            Session.is_revoked.is_(False),
            Session.expires_at > now(),
        )
    )
    active_users_7d = await db.scalar(
        select(func.count(func.distinct(Session.user_id))).where(
            Session.is_revoked.is_(False),
            Session.expires_at > now(),
            Session.created_at >= week_ago,
        )
    )
    returning_users_7d = await db.scalar(
        select(func.count(func.distinct(Session.user_id))).where(
            Session.is_revoked.is_(False),
            Session.created_at >= week_ago,
            Session.user_id.in_(
                select(Session.user_id).where(
                    Session.created_at < week_ago,
                    Session.created_at >= month_ago,
                )
            ),
        )
    )
    popular_score = Post.likes_count + Post.comments_count * 2 + Post.reposts_count * 3 + Post.saves_count * 3
    return {
        "users": await db.scalar(select(func.count(User.id))),
        "posts": await db.scalar(select(func.count(Post.id))),
        "comments": await db.scalar(select(func.count(Comment.id))),
        "communities": await db.scalar(select(func.count(Community.id))),
        "reports": open_reports,
        "reports_open": open_reports,
        "blocked_users": await db.scalar(select(func.count(User.id)).where(User.is_banned.is_(True))),
        "hashtags": await db.scalar(select(func.count(Hashtag.id))),
        "active_users": active_users or 0,
        "active_users_7d": active_users_7d or 0,
        "returning_users_7d": returning_users_7d or 0,
        "popular_posts_7d": await db.scalar(
            select(func.count(Post.id)).where(
                Post.is_deleted.is_(False),
                Post.status == "published",
                Post.created_at >= week_ago,
                popular_score > 0,
            )
        ),
        "community_growth_7d": await db.scalar(
            select(func.count(CommunityMember.id)).where(
                CommunityMember.status == "active",
                CommunityMember.joined_at >= week_ago,
            )
        ),
    }




@router.get("/api/admin/users")
async def admin_users(
    q: str | None = None,
    role: str | None = None,
    banned: bool | None = None,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    query = select(User)
    if q:
        needle = f"%{q.lower()}%"
        query = query.where(or_(func.lower(User.username).like(needle), func.lower(User.display_name).like(needle)))
    if role:
        query = query.where(User.role == role)
    if banned is not None:
        query = query.where(User.is_banned.is_(banned))
    rows = (await db.scalars(query.order_by(desc(User.created_at)).limit(100))).all()
    return [user_public(item, full=True) for item in rows]




@router.post("/api/admin/users/{user_id}/ban")
async def admin_ban_user(
    user_id: str,
    reason: str = "",
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_global_admin),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=403, detail="Cannot ban yourself")
    target.is_banned = True
    target.banned_until = None
    target.ban_reason = reason or None
    db.add(ModerationLog(moderator_id=user.id, action="ban_user", target_type="user", target_id=user_id, reason=reason))
    await notify(db, target.id, "account_restricted", {"reason": reason or "Аккаунт заблокирован администрацией."})
    await db.commit()
    return {"success": True}




@router.post("/api/admin/users/{user_id}/unban")
async def admin_unban_user(user_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(require_global_admin)):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.is_banned = False
    target.banned_until = None
    target.ban_reason = None
    db.add(ModerationLog(moderator_id=user.id, action="unban_user", target_type="user", target_id=user_id))
    await notify(db, target.id, "account_unrestricted", {"reason": "Блокировка аккаунта снята."})
    await db.commit()
    return {"success": True}




@router.post("/api/admin/users/{user_id}/role")
async def admin_set_user_role(
    user_id: str,
    payload: AdminRolePayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_global_admin),
):
    if payload.role not in {"user", "admin", "global_admin"}:
        raise HTTPException(status_code=422, detail="Invalid role")
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id and payload.role != "global_admin":
        raise HTTPException(status_code=403, detail="Cannot remove your own global admin role")
    target.role = payload.role
    db.add(ModerationLog(moderator_id=user.id, action="set_user_role", target_type="user", target_id=user_id, reason=payload.role))
    await notify(db, target.id, "role_updated", {"role": payload.role, "moderator": user.display_name})
    await db.commit()
    return {"success": True, "user": user_public(target, full=True)}




@router.post("/api/admin/users/{user_id}/moderation")
async def admin_moderate_user(
    user_id: str,
    payload: AdminModerationPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_global_admin),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id and payload.is_banned:
        raise HTTPException(status_code=403, detail="Cannot ban yourself")
    if payload.is_banned is not None:
        target.is_banned = payload.is_banned
        target.banned_until = now() + timedelta(hours=payload.duration_hours) if payload.is_banned and payload.duration_hours else None
        target.ban_reason = payload.reason if payload.is_banned else None
    if payload.restrictions is not None:
        target.restrictions = {key: bool(value) for key, value in payload.restrictions.items() if value}
    action = "moderate_user"
    db.add(
        ModerationLog(
            moderator_id=user.id,
            action=action,
            target_type="user",
            target_id=user_id,
            reason=payload.reason or json.dumps(target.restrictions or {}, ensure_ascii=False),
        )
    )
    is_restricted = bool(target.is_banned or target.restrictions)
    await notify(
        db,
        target.id,
        "account_restricted" if is_restricted else "account_unrestricted",
        {
            "reason": payload.reason or ("Изменены ограничения аккаунта." if is_restricted else "Ограничения аккаунта сняты."),
            "banned_until": target.banned_until.isoformat() if target.banned_until else None,
            "restrictions": target.restrictions or {},
        },
    )
    await db.commit()
    return {"success": True, "user": user_public(target, full=True)}




@router.get("/api/admin/reports")
async def admin_reports(
    status: str | None = None,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    query = select(Report)
    if status:
        if status == "pending":
            status = "open"
        query = query.where(Report.status == status)
    rows = (await db.scalars(query.order_by(desc(Report.created_at)).limit(200))).all()
    result = []
    for item in rows:
        context = None
        if item.target_type == "post":
            post = await db.get(Post, item.target_id)
            context = await post_public(db, post, user) if post else None
        elif item.target_type == "comment":
            comment = await db.get(Comment, item.target_id)
            context = {"text": comment.text, "post_id": comment.post_id, "author_id": comment.author_id} if comment else None
        elif item.target_type == "user":
            target_user = await db.get(User, item.target_id)
            context = user_public(target_user, full=True) if target_user else None
        elif item.target_type == "community":
            community = await db.get(Community, item.target_id)
            context = {
                "name": community.name,
                "slug": community.slug,
                "text": community.description,
                "is_banned": community.is_banned,
            } if community else None
        result.append(
            {
            "id": item.id,
            "reporter": user_public(await db.get(User, item.reporter_id)),
            "target_type": item.target_type,
            "target_id": item.target_id,
            "reason": item.reason,
            "description": item.description,
            "status": item.status,
            "moderator_id": item.moderator_id,
            "context": context,
            "created_at": item.created_at.isoformat(),
            "resolved_at": item.resolved_at.isoformat() if item.resolved_at else None,
        }
        )
    return result




@router.post("/api/admin/reports/{report_id}/resolve")
async def admin_resolve_report(
    report_id: str,
    payload: ResolveReportPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "open" if payload.status == "pending" else payload.status
    report.moderator_id = user.id
    report.resolved_at = now()
    if payload.action in {"hide_post", "delete_post"} and report.target_type == "post":
        post = await db.get(Post, report.target_id)
        if post:
            post.is_deleted = True
    elif payload.action in {"hide_comment", "delete_comment"} and report.target_type == "comment":
        comment = await db.get(Comment, report.target_id)
        if comment:
            comment.is_deleted = True
            comment.hidden_by_moderator = True
    elif payload.action == "ban_user" and report.target_type == "user":
        if user.role != "global_admin":
            raise HTTPException(status_code=403, detail="Global admin role required to ban users")
        target = await db.get(User, report.target_id)
        if target and target.id != user.id:
            target.is_banned = True
            target.ban_reason = payload.reason or report.reason
    elif payload.action == "ban_community" and report.target_type == "community":
        community = await db.get(Community, report.target_id)
        if community:
            community.is_banned = True
    db.add(
        ModerationLog(
            moderator_id=user.id,
            action=payload.action or "resolve_report",
            target_type=report.target_type,
            target_id=report.target_id,
            reason=payload.reason or report.reason,
        )
    )
    await db.commit()
    return {"success": True}




@router.get("/api/admin/logs")
async def admin_logs(
    action: str | None = None,
    target_type: str | None = None,
    moderator_id: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    query = select(ModerationLog)
    if action:
        query = query.where(ModerationLog.action == action)
    if target_type:
        query = query.where(ModerationLog.target_type == target_type)
    if moderator_id:
        query = query.where(ModerationLog.moderator_id == moderator_id)
    if q:
        needle = f"%{q.lower()}%"
        query = query.where(
            or_(
                func.lower(func.coalesce(ModerationLog.reason, "")).like(needle),
                func.lower(func.coalesce(ModerationLog.target_id, "")).like(needle),
            )
        )
    rows = (await db.scalars(query.order_by(desc(ModerationLog.created_at)).limit(300))).all()
    return [
        {
            "id": item.id,
            "moderator": user_public(await db.get(User, item.moderator_id)),
            "action": item.action,
            "target_type": item.target_type,
            "target_id": item.target_id,
            "reason": item.reason,
            "created_at": item.created_at.isoformat(),
        }
        for item in rows
    ]


# ---------------------------------------------------------------------------
# Posts management
# ---------------------------------------------------------------------------


@router.get("/api/admin/posts")
async def admin_posts(
    q: str | None = None,
    type: str | None = None,
    author_id: str | None = None,
    community_id: str | None = None,
    is_deleted: bool | None = None,
    is_pinned: bool | None = None,
    visibility: str | None = None,
    sort: str = "new",
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    query = select(Post)
    if q:
        needle = f"%{q.lower()}%"
        query = query.where(func.lower(func.coalesce(Post.text, "")).like(needle))
    if type:
        query = query.where(Post.type == type)
    if author_id:
        query = query.where(Post.author_id == author_id)
    if community_id:
        query = query.where(Post.community_id == community_id)
    if is_deleted is not None:
        query = query.where(Post.is_deleted.is_(is_deleted))
    if is_pinned is not None:
        query = query.where(Post.is_pinned.is_(is_pinned))
    if visibility:
        query = query.where(Post.visibility == visibility)

    if sort == "popular":
        query = query.order_by(desc(Post.likes_count + Post.comments_count * 2 + Post.reposts_count * 3))
    elif sort == "comments":
        query = query.order_by(desc(Post.comments_count))
    else:
        query = query.order_by(desc(Post.created_at))

    rows = (await db.scalars(query.limit(limit))).all()
    items = []
    for post in rows:
        author = await db.get(User, post.author_id)
        community = await db.get(Community, post.community_id) if post.community_id else None
        items.append({
            "id": post.id,
            "type": post.type,
            "text": post.text,
            "media_url": absolutize(post.media_url),
            "media_type": post.media_type,
            "author": user_public(author),
            "community": community_public(community),
            "is_deleted": post.is_deleted,
            "is_pinned": post.is_pinned,
            "visibility": post.visibility,
            "comments_enabled": post.comments_enabled,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "reposts_count": post.reposts_count,
            "saves_count": post.saves_count,
            "created_at": post.created_at.isoformat(),
        })
    return items


@router.post("/api/admin/posts/{post_id}/hide")
async def admin_hide_post(
    post_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_deleted = True
    db.add(ModerationLog(
        moderator_id=user.id,
        action="hide_post",
        target_type="post",
        target_id=post_id,
    ))
    if post.author_id and post.author_id != user.id:
        await notify(db, post.author_id, "post_hidden_by_moderator", {
            "post_id": post_id,
            "moderator": user.display_name,
        })
    await db.commit()
    return {"success": True, "post_id": post_id, "hidden": True}


@router.post("/api/admin/posts/{post_id}/restore")
async def admin_restore_post(
    post_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_deleted = False
    db.add(ModerationLog(
        moderator_id=user.id,
        action="restore_post",
        target_type="post",
        target_id=post_id,
    ))
    await db.commit()
    return {"success": True, "post_id": post_id, "hidden": False}


@router.post("/api/admin/posts/{post_id}/pin")
async def admin_pin_post(
    post_id: str,
    pinned: bool = True,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_pinned = bool(pinned)
    db.add(ModerationLog(
        moderator_id=user.id,
        action=("pin_post" if pinned else "unpin_post"),
        target_type="post",
        target_id=post_id,
    ))
    await db.commit()
    return {"success": True, "post_id": post_id, "pinned": bool(pinned)}


@router.delete("/api/admin/posts/{post_id}")
async def admin_delete_post(
    post_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_global_admin),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_deleted = True
    db.add(ModerationLog(
        moderator_id=user.id,
        action="delete_post",
        target_type="post",
        target_id=post_id,
    ))
    await db.commit()
    return {"success": True}


# ---------------------------------------------------------------------------
# Comments management
# ---------------------------------------------------------------------------


@router.get("/api/admin/comments")
async def admin_comments(
    q: str | None = None,
    author_id: str | None = None,
    post_id: str | None = None,
    is_deleted: bool | None = None,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    query = select(Comment)
    if q:
        needle = f"%{q.lower()}%"
        query = query.where(func.lower(Comment.text).like(needle))
    if author_id:
        query = query.where(Comment.author_id == author_id)
    if post_id:
        query = query.where(Comment.post_id == post_id)
    if is_deleted is not None:
        query = query.where(Comment.is_deleted.is_(is_deleted))
    rows = (await db.scalars(query.order_by(desc(Comment.created_at)).limit(limit))).all()

    items = []
    author_ids = {c.author_id for c in rows}
    post_ids = {c.post_id for c in rows}
    authors = {u.id: u for u in (await db.scalars(select(User).where(User.id.in_(author_ids)))).all()} if author_ids else {}
    posts = {p.id: p for p in (await db.scalars(select(Post).where(Post.id.in_(post_ids)))).all()} if post_ids else {}
    for c in rows:
        items.append({
            "id": c.id,
            "post_id": c.post_id,
            "author": user_public(authors.get(c.author_id)),
            "text": c.text,
            "likes_count": c.likes_count,
            "is_deleted": c.is_deleted,
            "hidden_by_moderator": c.hidden_by_moderator,
            "parent_comment_id": c.parent_comment_id,
            "created_at": c.created_at.isoformat(),
            "post_text": (posts.get(c.post_id).text[:140] if posts.get(c.post_id) else ""),
        })
    return items


@router.post("/api/admin/comments/{comment_id}/hide")
async def admin_hide_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.is_deleted = True
    comment.hidden_by_moderator = True
    db.add(ModerationLog(
        moderator_id=user.id,
        action="hide_comment",
        target_type="comment",
        target_id=comment_id,
    ))
    if comment.author_id and comment.author_id != user.id:
        await notify(db, comment.author_id, "comment_hidden_by_moderator", {
            "comment_id": comment_id,
            "moderator": user.display_name,
        })
    await db.commit()
    return {"success": True, "comment_id": comment_id}


@router.post("/api/admin/comments/{comment_id}/restore")
async def admin_restore_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.is_deleted = False
    comment.hidden_by_moderator = False
    db.add(ModerationLog(
        moderator_id=user.id,
        action="restore_comment",
        target_type="comment",
        target_id=comment_id,
    ))
    await db.commit()
    return {"success": True, "comment_id": comment_id}


@router.delete("/api/admin/comments/{comment_id}")
async def admin_delete_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.is_deleted = True
    comment.hidden_by_moderator = True
    db.add(ModerationLog(
        moderator_id=user.id,
        action="delete_comment",
        target_type="comment",
        target_id=comment_id,
    ))
    await db.commit()
    return {"success": True}


# ---------------------------------------------------------------------------
# Communities management
# ---------------------------------------------------------------------------


@router.get("/api/admin/communities")
async def admin_communities(
    q: str | None = None,
    is_banned: bool | None = None,
    type: str | None = None,
    sort: str = "new",
    limit: int = Query(default=80, le=200),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    query = select(Community)
    if q:
        needle = f"%{q.lower()}%"
        query = query.where(or_(
            func.lower(Community.name).like(needle),
            func.lower(func.coalesce(Community.slug, "")).like(needle),
            func.lower(func.coalesce(Community.description, "")).like(needle),
        ))
    if is_banned is not None:
        query = query.where(Community.is_banned.is_(is_banned))
    if type:
        query = query.where(Community.type == type)
    if sort == "members":
        query = query.order_by(desc(Community.members_count))
    elif sort == "posts":
        query = query.order_by(desc(Community.posts_count))
    else:
        query = query.order_by(desc(Community.created_at))
    rows = (await db.scalars(query.limit(limit))).all()
    items = []
    for c in rows:
        owner = await db.get(User, c.owner_id)
        items.append({
            **community_public(c),
            "owner": user_public(owner),
        })
    return items


@router.post("/api/admin/communities/{community_id}/ban")
async def admin_ban_community(
    community_id: str,
    reason: str = "",
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    community = await db.get(Community, community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    community.is_banned = True
    db.add(ModerationLog(
        moderator_id=user.id,
        action="ban_community",
        target_type="community",
        target_id=community_id,
        reason=reason,
    ))
    if community.owner_id and community.owner_id != user.id:
        await notify(db, community.owner_id, "community_banned", {
            "community_id": community_id,
            "reason": reason or "Сообщество заблокировано администрацией.",
            "moderator": user.display_name,
        })
    await db.commit()
    return {"success": True}


@router.post("/api/admin/communities/{community_id}/unban")
async def admin_unban_community(
    community_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    community = await db.get(Community, community_id)
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    community.is_banned = False
    db.add(ModerationLog(
        moderator_id=user.id,
        action="unban_community",
        target_type="community",
        target_id=community_id,
    ))
    if community.owner_id and community.owner_id != user.id:
        await notify(db, community.owner_id, "community_unbanned", {
            "community_id": community_id,
            "moderator": user.display_name,
        })
    await db.commit()
    return {"success": True}


# ---------------------------------------------------------------------------
# Hashtags management
# ---------------------------------------------------------------------------


@router.get("/api/admin/hashtags")
async def admin_hashtags(
    q: str | None = None,
    sort: str = "popular",
    limit: int = Query(default=100, le=300),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    query = select(Hashtag)
    if q:
        needle = f"%{q.lower()}%"
        query = query.where(func.lower(Hashtag.name).like(needle))
    if sort == "popular":
        query = query.order_by(desc(Hashtag.posts_count))
    elif sort == "new":
        query = query.order_by(desc(Hashtag.created_at))
    else:
        query = query.order_by(Hashtag.name.asc())
    rows = (await db.scalars(query.limit(limit))).all()
    return [
        {
            "id": h.id,
            "name": h.name,
            "posts_count": h.posts_count,
            "created_at": h.created_at.isoformat(),
        }
        for h in rows
    ]


@router.delete("/api/admin/hashtags/{hashtag_id}")
async def admin_delete_hashtag(
    hashtag_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    hashtag = await db.get(Hashtag, hashtag_id)
    if not hashtag:
        raise HTTPException(status_code=404, detail="Hashtag not found")
    await db.execute(PostHashtag.__table__.delete().where(PostHashtag.hashtag_id == hashtag_id))
    await db.delete(hashtag)
    db.add(ModerationLog(
        moderator_id=user.id,
        action="delete_hashtag",
        target_type="hashtag",
        target_id=hashtag_id,
        reason=hashtag.name,
    ))
    await db.commit()
    return {"success": True}


# ---------------------------------------------------------------------------
# Analytics & time series
# ---------------------------------------------------------------------------


def _bucket_key(dt, bucket: str) -> str:
    if bucket == "hour":
        return dt.strftime("%Y-%m-%dT%H:00:00Z")
    if bucket == "month":
        return dt.strftime("%Y-%m-01T00:00:00Z")
    return dt.strftime("%Y-%m-%dT00:00:00Z")


@router.get("/api/admin/analytics/timeseries")
async def admin_timeseries(
    days: int = Query(default=14, ge=1, le=90),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    start = now() - timedelta(days=days)

    user_dates = (await db.scalars(
        select(User.created_at).where(User.created_at >= start)
    )).all()
    post_dates = (await db.scalars(
        select(Post.created_at).where(Post.created_at >= start, Post.is_deleted.is_(False))
    )).all()
    comment_dates = (await db.scalars(
        select(Comment.created_at).where(Comment.created_at >= start, Comment.is_deleted.is_(False))
    )).all()
    report_dates = (await db.scalars(
        select(Report.created_at).where(Report.created_at >= start)
    )).all()

    def aggregate(dates: list) -> dict[str, int]:
        out: dict[str, int] = {}
        for d in dates:
            key = d.strftime("%Y-%m-%d")
            out[key] = out.get(key, 0) + 1
        return out

    users_map = aggregate(user_dates)
    posts_map = aggregate(post_dates)
    comments_map = aggregate(comment_dates)
    reports_map = aggregate(report_dates)

    days_list = [(start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days + 1)]
    return {
        "days": days_list,
        "users": [users_map.get(d, 0) for d in days_list],
        "posts": [posts_map.get(d, 0) for d in days_list],
        "comments": [comments_map.get(d, 0) for d in days_list],
        "reports": [reports_map.get(d, 0) for d in days_list],
    }


@router.get("/api/admin/analytics/top")
async def admin_top(
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    week_ago = now() - timedelta(days=7)
    score = Post.likes_count + Post.comments_count * 2 + Post.reposts_count * 3

    top_posts = (await db.scalars(
        select(Post)
        .where(Post.is_deleted.is_(False), Post.status == "published", Post.created_at >= week_ago)
        .order_by(desc(score))
        .limit(8)
    )).all()
    top_users = (await db.scalars(
        select(User)
        .where(User.is_banned.is_(False))
        .order_by(desc(User.posts_count + User.followers_count // 10))
        .limit(8)
    )).all()
    top_communities = (await db.scalars(
        select(Community)
        .where(Community.is_banned.is_(False))
        .order_by(desc(Community.members_count))
        .limit(8)
    )).all()
    top_reports_reason = (await db.execute(
        select(Report.reason, func.count(Report.id).label("cnt"))
        .where(Report.created_at >= week_ago)
        .group_by(Report.reason)
        .order_by(desc("cnt"))
        .limit(8)
    )).all()

    return {
        "top_posts": [await post_public(db, p) for p in top_posts],
        "top_users": [user_public(u) for u in top_users],
        "top_communities": [community_public(c) for c in top_communities],
        "top_report_reasons": [{"reason": r[0], "count": r[1]} for r in top_reports_reason],
    }


@router.get("/api/admin/analytics/moderation")
async def admin_moderation_analytics(
    days: int = Query(default=30, ge=1, le=90),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    start = now() - timedelta(days=days)
    by_action = (await db.execute(
        select(ModerationLog.action, func.count(ModerationLog.id))
        .where(ModerationLog.created_at >= start)
        .group_by(ModerationLog.action)
        .order_by(desc(func.count(ModerationLog.id)))
    )).all()
    by_target = (await db.execute(
        select(ModerationLog.target_type, func.count(ModerationLog.id))
        .where(ModerationLog.created_at >= start)
        .group_by(ModerationLog.target_type)
    )).all()
    by_moderator = (await db.execute(
        select(ModerationLog.moderator_id, func.count(ModerationLog.id).label("cnt"))
        .where(ModerationLog.created_at >= start)
        .group_by(ModerationLog.moderator_id)
        .order_by(desc("cnt"))
        .limit(10)
    )).all()
    moderators = []
    for mod_id, cnt in by_moderator:
        u = await db.get(User, mod_id)
        moderators.append({
            "moderator": user_public(u),
            "count": cnt,
        })
    return {
        "by_action": [{"action": r[0], "count": r[1]} for r in by_action],
        "by_target": [{"target_type": r[0], "count": r[1]} for r in by_target],
        "by_moderator": moderators,
    }


# ---------------------------------------------------------------------------
# Sessions & system
# ---------------------------------------------------------------------------


@router.get("/api/admin/sessions")
async def admin_sessions(
    limit: int = Query(default=100, le=300),
    q: str | None = Query(default=None, description="Filter by user_id"),
    status: str | None = Query(default=None, description="all|active|revoked"),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    query = select(Session).order_by(desc(Session.created_at))
    if q:
        query = query.where(Session.user_id == q)
    if status == "active":
        query = query.where(Session.is_revoked.is_(False))
    elif status == "revoked":
        query = query.where(Session.is_revoked.is_(True))
    rows = (await db.scalars(query.limit(limit))).all()
    items = []
    for s in rows:
        u = await db.get(User, s.user_id)
        items.append({
            "id": s.id,
            "user_id": s.user_id,
            "user": user_public(u),
            "user_agent": s.user_agent,
            "ip_address": s.ip_address,
            "is_revoked": s.is_revoked,
            "is_current": s.id == getattr(user, "current_session_id", None) or False,
            "created_at": s.created_at.isoformat(),
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        })
    return items


@router.delete("/api/admin/sessions/{session_id}")
async def admin_revoke_session(
    session_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_revoked = True
    db.add(ModerationLog(
        moderator_id=user.id,
        action="revoke_session",
        target_type="session",
        target_id=session_id,
        reason=f"User: {session.user_id}",
    ))
    await db.commit()
    return {"success": True}


@router.post("/api/admin/users/{user_id}/sessions/revoke-all")
async def admin_revoke_user_sessions(
    user_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    sessions = (await db.scalars(select(Session).where(Session.user_id == user_id, Session.is_revoked.is_(False)))).all()
    for s in sessions:
        s.is_revoked = True
    db.add(ModerationLog(
        moderator_id=user.id,
        action="revoke_all_sessions",
        target_type="user",
        target_id=user_id,
        reason=f"Count: {len(sessions)}",
    ))
    await db.commit()
    return {"success": True, "revoked": len(sessions)}


@router.get("/api/admin/system")
async def admin_system(
    db: AsyncSession = Depends(get_session),
    user: User = Depends(require_global_admin),
):
    one_day = now() - timedelta(days=1)
    one_week = now() - timedelta(days=7)

    active_sessions = await db.scalar(
        select(func.count(Session.id)).where(Session.is_revoked.is_(False), Session.expires_at > now())
    )
    revoked_sessions = await db.scalar(
        select(func.count(Session.id)).where(Session.is_revoked.is_(True))
    )
    sessions_today = await db.scalar(
        select(func.count(Session.id)).where(Session.created_at >= one_day)
    )
    new_users_today = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= one_day)
    )
    new_users_week = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= one_week)
    )
    new_posts_today = await db.scalar(
        select(func.count(Post.id)).where(Post.created_at >= one_day, Post.is_deleted.is_(False))
    )
    new_comments_today = await db.scalar(
        select(func.count(Comment.id)).where(Comment.created_at >= one_day, Comment.is_deleted.is_(False))
    )
    total_users = await db.scalar(select(func.count(User.id)))
    total_posts = await db.scalar(select(func.count(Post.id)).where(Post.is_deleted.is_(False)))
    total_communities = await db.scalar(select(func.count(Community.id)))
    banned_users = await db.scalar(select(func.count(User.id)).where(User.is_banned.is_(True)))
    restricted_users = await db.scalar(
        select(func.count(User.id)).where(User.restrictions != {})
    )
    banned_communities = await db.scalar(
        select(func.count(Community.id)).where(Community.is_banned.is_(True))
    )
    open_reports = await db.scalar(
        select(func.count(Report.id)).where(Report.status.in_(("open", "pending")))
    )
    resolved_reports_week = await db.scalar(
        select(func.count(Report.id)).where(
            Report.status.in_(("resolved", "rejected")),
            Report.resolved_at >= one_week,
        )
    )
    mod_actions_week = await db.scalar(
        select(func.count(ModerationLog.id)).where(ModerationLog.created_at >= one_week)
    )

    # Health checks
    checks = []
    try:
        await db.execute(text("SELECT 1"))
        checks.append({"name": "Database", "ok": True, "detail": "Reachable"})
    except Exception as exc:
        checks.append({"name": "Database", "ok": False, "detail": str(exc)[:120]})

    db_kind = "sqlite" if "sqlite" in str(settings.database_url).lower() else "postgres"
    checks.append({
        "name": "Database type",
        "ok": True,
        "detail": db_kind,
    })
    checks.append({
        "name": "Sessions",
        "ok": (active_sessions or 0) >= 0,
        "detail": f"{active_sessions or 0} active / {revoked_sessions or 0} revoked",
    })
    checks.append({
        "name": "Reports queue",
        "ok": (open_reports or 0) < 100,
        "detail": f"{open_reports or 0} open",
    })
    checks.append({
        "name": "Uptime",
        "ok": True,
        "detail": f"~{int((now() - _app_start_time).total_seconds())}s",
    })

    return {
        "environment": settings.environment,
        "app_name": settings.app_name,
        "version": getattr(settings, "version", "1.0.0"),
        "active_sessions": active_sessions or 0,
        "revoked_sessions": revoked_sessions or 0,
        "sessions_today": sessions_today or 0,
        "new_users_today": new_users_today or 0,
        "new_users_week": new_users_week or 0,
        "new_posts_today": new_posts_today or 0,
        "new_comments_today": new_comments_today or 0,
        "total_users": total_users or 0,
        "total_posts": total_posts or 0,
        "total_communities": total_communities or 0,
        "banned_users": banned_users or 0,
        "restricted_users": restricted_users or 0,
        "banned_communities": banned_communities or 0,
        "open_reports": open_reports or 0,
        "resolved_reports_week": resolved_reports_week or 0,
        "mod_actions_week": mod_actions_week or 0,
        "server_time": now().isoformat(),
        "uptime": f"~{int((now() - _app_start_time).total_seconds())}s",
        "python_version": sys.version.split()[0],
        "database": db_kind,
        "checks": checks,
    }
