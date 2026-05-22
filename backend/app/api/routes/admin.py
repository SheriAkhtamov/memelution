from __future__ import annotations

import json
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_user,
    require_admin,
)
from app.db.session import get_session
from app.models import (
    Comment, Community, CommunityMember,
    Hashtag, ModerationLog,
    Post, Report, Session, User, now,
)
from app.schemas import (
    AdminModerationPayload, AdminRolePayload, ReportPayload, ResolveReportPayload,
)
from app.services.api_support import *  # noqa: F403

router = APIRouter()

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
async def admin_logs(db: AsyncSession = Depends(get_session), user: User = Depends(require_admin)):
    rows = (await db.scalars(select(ModerationLog).order_by(desc(ModerationLog.created_at)).limit(200))).all()
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
