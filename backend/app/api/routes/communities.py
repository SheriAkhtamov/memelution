from __future__ import annotations


from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_user,
    get_optional_user,
)
from app.db.session import get_session
from app.models import (
    Community, CommunityInvite, CommunityMember,
    MediaFile, Post, User, now,
)
from app.schemas import (
    AdminRolePayload, CommunityInvitePayload, CommunityPayload,
)
from app.services.api_support import *  # noqa: F403
from app.services.media import save_upload

router = APIRouter()

@router.get("/api/communities")
async def list_communities(
    q: str | None = None,
    category_id: str | None = None,
    type: str | None = None,
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    query = select(Community).where(Community.is_banned.is_(False))
    if q:
        needle = f"%{q.lower()}%"
        query = query.where(or_(func.lower(Community.name).like(needle), func.lower(Community.description).like(needle)))
    if category_id:
        query = query.where(Community.category_id == category_id)
    if type in {"public", "closed", "private"}:
        query = query.where(Community.type == type)
    rows = (await db.scalars(query.order_by(desc(Community.members_count), Community.name))).all()
    result = []
    for row in rows:
        item = community_public(row)
        if viewer:
            membership = await db.scalar(
                select(CommunityMember).where(CommunityMember.community_id == row.id, CommunityMember.user_id == viewer.id)
            )
            item["membership"] = membership.status if membership else None
            item["role"] = membership.role if membership else None
        result.append(item)
    return result




@router.post("/api/communities")
async def create_community(
    payload: CommunityPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    ensure_not_restricted(user, "communities")
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=422, detail="Community name is required")
    slug = await unique_community_slug(db, payload.slug)
    community = Community(
        owner_id=user.id,
        name=payload.name.strip(),
        slug=slug,
        description=payload.description or "",
        avatar_url=payload.avatar_url,
        cover_url=payload.cover_url,
        category_id=payload.category_id,
        type=payload.type or "public",
        language=payload.language or "ru",
        rules=payload.rules or "",
        settings=payload.settings or {},
        members_count=1,
    )
    db.add(community)
    await db.flush()
    db.add(CommunityMember(community_id=community.id, user_id=user.id, role="creator", status="active"))
    await db.commit()
    await db.refresh(community)
    return community_public(community)




@router.get("/api/communities/{slug}")
async def get_community(
    slug: str,
    tab: str = "feed",
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community or community.is_banned:
        raise HTTPException(status_code=404, detail="Community not found")
    posts_query = select(Post).where(Post.community_id == community.id, Post.is_deleted.is_(False), Post.status == "published")
    if tab == "popular":
        posts_query = posts_query.order_by(desc(Post.likes_count + Post.comments_count + Post.reposts_count))
    elif tab == "media":
        posts_query = posts_query.where(Post.media_url.is_not(None)).order_by(desc(Post.created_at))
    elif tab == "new":
        posts_query = posts_query.order_by(desc(Post.created_at))
    else:
        posts_query = posts_query.order_by(desc(Post.is_pinned), desc(Post.created_at))
    posts = (await db.scalars(posts_query.limit(50))).all()
    members = (
        await db.scalars(
            select(CommunityMember).where(CommunityMember.community_id == community.id, CommunityMember.status == "active")
        )
    ).all()
    moderators = [
        await db.get(User, member.user_id)
        for member in members
        if member.role in {"creator", "admin", "moderator"}
    ]
    membership = None
    if viewer:
        membership = await db.scalar(
            select(CommunityMember).where(CommunityMember.community_id == community.id, CommunityMember.user_id == viewer.id)
        )
    return {
        "community": community_public(community),
        "membership": membership.status if membership else None,
        "role": membership.role if membership else None,
        "posts": await posts_public(db, posts, viewer),
        "moderators": [user_public(item) for item in moderators if item],
        "analytics": {
            "members_count": community.members_count,
            "posts_count": community.posts_count,
            "pending_requests": await db.scalar(
                select(func.count(CommunityMember.id)).where(
                    CommunityMember.community_id == community.id,
                    CommunityMember.status == "pending",
                )
            ),
        },
    }




@router.patch("/api/communities/{slug}")
async def update_community(
    slug: str,
    payload: CommunityPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "slug":
            value = await unique_community_slug(db, value, community.id)
        elif field == "name":
            if not value or not str(value).strip():
                raise HTTPException(status_code=422, detail="Community name is required")
            value = str(value).strip()
        elif field in {"description", "rules"} and value is None:
            value = ""
        elif field in {"type", "language"} and value is None:
            continue
        elif field == "settings" and value is None:
            value = {}
        setattr(community, field, value)
    await db.commit()
    return community_public(community)


@router.post("/api/communities/{slug}/avatar")
async def upload_community_avatar(
    slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    file_url, size, file_type = await save_upload(file, user.id)
    db.add(MediaFile(user_id=user.id, file_url=file_url, file_type=file_type, file_size=size))
    community.avatar_url = file_url
    await db.commit()
    await db.refresh(community)
    return community_public(community)


@router.post("/api/communities/{slug}/cover")
async def upload_community_cover(
    slug: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    file_url, size, file_type = await save_upload(file, user.id)
    db.add(MediaFile(user_id=user.id, file_url=file_url, file_type=file_type, file_size=size))
    community.cover_url = file_url
    await db.commit()
    await db.refresh(community)
    return community_public(community)




@router.post("/api/communities/{slug}/join")
async def join_community(slug: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    existing = await db.scalar(
        select(CommunityMember).where(CommunityMember.community_id == community.id, CommunityMember.user_id == user.id)
    )
    status = "pending" if community.type == "closed" else "active"
    if community.type == "private":
        invite = await db.scalar(
            select(CommunityInvite).where(
                CommunityInvite.community_id == community.id,
                CommunityInvite.user_id == user.id,
                CommunityInvite.status == "pending",
            )
        )
        if not invite:
            raise HTTPException(status_code=403, detail="Private community requires invitation")
        invite.status = "accepted"
        invite.responded_at = now()
    if existing:
        if existing.status == "banned":
            raise HTTPException(status_code=403, detail="User is banned from this community")
        existing.status = status if existing.status != "active" else existing.status
        status = existing.status
    else:
        db.add(CommunityMember(community_id=community.id, user_id=user.id, role="member", status=status))
        if status == "active":
            community.members_count += 1
    await db.commit()
    return {"success": True, "membership": status}


@router.post("/api/communities/{slug}/invite")
async def invite_community_member(
    slug: str,
    payload: CommunityInvitePayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    target = None
    if payload.user_id:
        target = await db.get(User, payload.user_id)
    elif payload.username:
        target = await db.scalar(select(User).where(User.username == payload.username.lstrip("@").lower()))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.scalar(
        select(CommunityInvite).where(CommunityInvite.community_id == community.id, CommunityInvite.user_id == target.id)
    )
    if not existing:
        existing = CommunityInvite(community_id=community.id, user_id=target.id, inviter_id=user.id)
        db.add(existing)
    else:
        existing.status = "pending"
        existing.inviter_id = user.id
    await notify(db, target.id, "community_invite", {"community_id": community.id, "slug": community.slug, "name": community.name})
    await db.commit()
    return {"success": True, "invite_id": existing.id}




@router.delete("/api/communities/{slug}/join")
async def leave_community(slug: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    member = await db.scalar(
        select(CommunityMember).where(CommunityMember.community_id == community.id, CommunityMember.user_id == user.id)
    )
    if member and member.role != "creator":
        await db.delete(member)
        community.members_count = max(0, community.members_count - 1)
    await db.commit()
    return {"success": True, "membership": None}




@router.get("/api/communities/{slug}/members")
async def community_members(slug: str, db: AsyncSession = Depends(get_session)):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    rows = (
        await db.scalars(
            select(CommunityMember).where(CommunityMember.community_id == community.id).order_by(CommunityMember.joined_at)
        )
    ).all()
    result = []
    for row in rows:
        member_user = await db.get(User, row.user_id)
        result.append({"membership": row.status, "role": row.role, "user": user_public(member_user)})
    return result


@router.get("/api/communities/{slug}/ban-list")
async def community_ban_list(slug: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    rows = (
        await db.scalars(
            select(CommunityMember).where(CommunityMember.community_id == community.id, CommunityMember.status == "banned")
        )
    ).all()
    return [{"id": item.id, "role": item.role, "user": user_public(await db.get(User, item.user_id))} for item in rows]




@router.get("/api/communities/{slug}/requests")
async def community_requests(slug: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    rows = (
        await db.scalars(
            select(CommunityMember)
            .where(CommunityMember.community_id == community.id, CommunityMember.status == "pending")
            .order_by(CommunityMember.joined_at)
        )
    ).all()
    return [
        {"id": item.id, "membership": item.status, "role": item.role, "user": user_public(await db.get(User, item.user_id))}
        for item in rows
    ]




@router.post("/api/communities/{slug}/requests/{member_id}/approve")
async def approve_request(
    slug: str,
    member_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    member = await db.get(CommunityMember, member_id)
    if not member or member.community_id != community.id:
        raise HTTPException(status_code=404, detail="Request not found")
    if member.status != "pending":
        return {"success": True}
    member.status = "active"
    community.members_count += 1
    await notify(db, member.user_id, "community_request_approved", {"community_id": community.id, "name": community.name})
    await db.commit()
    return {"success": True}




@router.post("/api/communities/{slug}/requests/{member_id}/reject")
async def reject_request(
    slug: str,
    member_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    member = await db.get(CommunityMember, member_id)
    if not member or member.community_id != community.id:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.delete(member)
    await notify(db, member.user_id, "community_request_rejected", {"community_id": community.id, "name": community.name})
    await db.commit()
    return {"success": True}




@router.post("/api/communities/{slug}/members/{member_id}/role")
async def update_member_role(
    slug: str,
    member_id: str,
    payload: AdminRolePayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    manager = await require_community_manager(db, community.id, user)
    if manager.role not in {"creator", "admin"} and user.role != "global_admin":
        raise HTTPException(status_code=403, detail="Community admin role required")
    if payload.role not in {"member", "moderator", "admin"}:
        raise HTTPException(status_code=422, detail="Invalid community role")
    member = await db.get(CommunityMember, member_id)
    if not member or member.community_id != community.id:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == "creator":
        raise HTTPException(status_code=403, detail="Cannot change creator role")
    member.role = payload.role
    await db.commit()
    return {"success": True}




@router.post("/api/communities/{slug}/members/{member_id}/ban")
async def ban_member(
    slug: str,
    member_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    manager = await require_community_manager(db, community.id, user)
    member = await db.get(CommunityMember, member_id)
    if not member or member.community_id != community.id:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == "creator":
        raise HTTPException(status_code=403, detail="Cannot ban the community creator")
    if member.role == "admin" and manager.role not in {"creator", "admin"} and user.role != "global_admin":
        raise HTTPException(status_code=403, detail="Cannot ban an admin")
    if member.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot ban yourself")
    member.status = "banned"
    await db.commit()
    return {"success": True}




@router.post("/api/communities/{slug}/members/{member_id}/unban")
async def unban_member(
    slug: str,
    member_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    community = await db.scalar(select(Community).where(Community.slug == slug))
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    await require_community_manager(db, community.id, user)
    member = await db.get(CommunityMember, member_id)
    if not member or member.community_id != community.id:
        raise HTTPException(status_code=404, detail="Member not found")
    member.status = "active"
    await db.commit()
    return {"success": True}
