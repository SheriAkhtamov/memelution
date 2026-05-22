from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    ensure_username_available,
    get_current_user,
    get_optional_user,
)
from app.db.session import get_session
from app.models import (
    Community, Follow, Like, MediaFile, Post, Repost, SaveCollection,
    User, UserBlock,
)
from app.schemas import (
    UpdateProfilePayload,
)
from app.services.api_support import *  # noqa: F403
from app.services.media import save_upload

router = APIRouter()


def _privacy_value(user: User, key: str, default: Any) -> Any:
    return (user.privacy or {}).get(key, default)


async def _can_view_profile(db: AsyncSession, profile: User, viewer: User | None) -> bool:
    if viewer and viewer.id == profile.id:
        return True
    visibility = _privacy_value(profile, "profile_visibility", "public")
    if visibility == "public":
        return True
    if visibility == "private" or not viewer:
        return False
    return bool(
        await db.scalar(select(Follow).where(Follow.follower_id == viewer.id, Follow.following_id == profile.id))
    )


async def _achievement_summary(db: AsyncSession, user: User) -> dict[str, Any]:
    total_likes, total_comments, total_reposts, total_saves, top_meme_rating = (
        await db.execute(
            select(
                func.coalesce(func.sum(Post.likes_count), 0),
                func.coalesce(func.sum(Post.comments_count), 0),
                func.coalesce(func.sum(Post.reposts_count), 0),
                func.coalesce(func.sum(Post.saves_count), 0),
                func.coalesce(func.max(Post.likes_count + Post.comments_count * 2 + Post.reposts_count * 3 + Post.saves_count * 3), 0),
            ).where(Post.author_id == user.id, Post.is_deleted.is_(False), Post.status == "published")
        )
    ).one()
    posts_count = int(user.posts_count or 0)
    total_likes = int(total_likes or 0)
    total_comments = int(total_comments or 0)
    total_reposts = int(total_reposts or 0)
    total_saves = int(total_saves or 0)
    meme_rating = int(top_meme_rating or 0)
    activity_score = posts_count * 5 + total_likes + total_comments * 2 + total_reposts * 3 + total_saves * 3
    achievement_level = max(1, min(20, activity_score // 100 + 1))
    achievements = [
        {
            "id": "first-post",
            "title": "Первый мем",
            "description": "Опубликовать первый пост",
            "icon": "sparkles",
            "unlocked": posts_count >= 1,
        },
        {
            "id": "meme-maker",
            "title": "Мемодел",
            "description": "Набрать 10 реакций на постах",
            "icon": "badge",
            "unlocked": total_likes >= 10,
        },
        {
            "id": "viral-spark",
            "title": "Вирусная искра",
            "description": "Получить рейтинг мема 50+",
            "icon": "flame",
            "unlocked": meme_rating >= 50,
        },
        {
            "id": "active-voice",
            "title": "Активный голос",
            "description": "Достичь 250 очков активности",
            "icon": "activity",
            "unlocked": activity_score >= 250,
        },
    ]
    return {
        "achievement_level": achievement_level,
        "activity_score": activity_score,
        "meme_rating": meme_rating,
        "achievements": achievements,
    }


def _profile_posts_query(query, profile: User, viewer: User | None, is_following: bool):
    if viewer and viewer.id == profile.id:
        return query
    if viewer and is_following:
        return query.where(Post.visibility.in_(["public", "followers"]))
    return query.where(Post.visibility == "public")


@router.get("/api/me")
async def me(user: User = Depends(get_current_user)):
    return user_public(user, full=True)




@router.patch("/api/users/me")
async def update_me(
    payload: UpdateProfilePayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    data = payload.model_dump(exclude_unset=True)
    if "username" in data and data["username"]:
        user.username = await ensure_username_available(db, data["username"], user.id)
    if "privacy" in data and data["privacy"] is not None:
        data["privacy"] = {**(user.privacy or {}), **data["privacy"]}
    for field in [
        "display_name",
        "avatar_url",
        "cover_url",
        "bio",
        "website",
        "language",
        "interests",
        "location",
        "privacy",
        "notification_settings",
        "onboarding_completed",
    ]:
        if field in data:
            setattr(user, field, data[field])
    await db.commit()
    await db.refresh(user)
    return user_public(user, full=True)


@router.post("/api/users/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    file_url, size, file_type = await save_upload(file, user.id)
    db.add(MediaFile(user_id=user.id, file_url=file_url, file_type=file_type, file_size=size))
    user.avatar_url = file_url
    await db.commit()
    await db.refresh(user)
    return user_public(user, full=True)


@router.post("/api/users/me/cover")
async def upload_cover(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    file_url, size, file_type = await save_upload(file, user.id)
    db.add(MediaFile(user_id=user.id, file_url=file_url, file_type=file_type, file_size=size))
    user.cover_url = file_url
    await db.commit()
    await db.refresh(user)
    return user_public(user, full=True)




@router.get("/api/users/{username}")
async def get_profile(
    username: str,
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    user = await db.scalar(select(User).where(User.username == username.lstrip("@").lower()))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    can_view_profile = await _can_view_profile(db, user, viewer)
    is_following = False
    is_blocked = False
    if viewer:
        is_following = bool(
            await db.scalar(select(Follow).where(Follow.follower_id == viewer.id, Follow.following_id == user.id))
        )
        is_blocked = bool(
            await db.scalar(select(UserBlock).where(UserBlock.blocker_id == viewer.id, UserBlock.blocked_id == user.id))
        )
    posts_query = _profile_posts_query(
        select(Post)
        .where(Post.author_id == user.id, Post.is_deleted.is_(False), Post.status == "published")
        .order_by(desc(Post.created_at))
        .limit(30),
        user,
        viewer,
        is_following,
    )
    posts = (await db.scalars(posts_query)).all() if can_view_profile else []
    communities = (
        await db.scalars(select(Community).where(Community.owner_id == user.id).order_by(desc(Community.created_at)))
    ).all() if can_view_profile else []
    collections = (
        await db.scalars(
            select(SaveCollection)
            .where(SaveCollection.user_id == user.id, SaveCollection.visibility == "public")
            .order_by(SaveCollection.sort_order, desc(SaveCollection.created_at))
        )
    ).all() if can_view_profile else []
    liked_posts: list[Post] = []
    if can_view_profile and viewer and (viewer.id == user.id or (user.privacy or {}).get("show_likes")):
        liked_ids = (
            await db.scalars(
                select(Like.target_id)
                .where(Like.user_id == user.id, Like.target_type == "post")
                .order_by(desc(Like.created_at))
                .limit(30)
            )
        ).all()
        if liked_ids:
            liked_posts = (
                await db.scalars(
                    select(Post).where(Post.id.in_(liked_ids), Post.is_deleted.is_(False), Post.status == "published")
                )
            ).all()
    reposted_ids = (
        await db.scalars(
            select(Repost.post_id)
            .where(Repost.user_id == user.id)
            .order_by(desc(Repost.created_at))
            .limit(30)
        )
    ).all() if can_view_profile else []
    reposted_posts: list[Post] = []
    if reposted_ids:
        reposted_posts = (
            await db.scalars(
                select(Post).where(Post.id.in_(reposted_ids), Post.is_deleted.is_(False), Post.status == "published")
            )
        ).all()
    profile_user = user_public(user)
    if can_view_profile and profile_user:
        profile_user.update(await _achievement_summary(db, user))
    return {
        "user": profile_user,
        "is_following": is_following,
        "is_blocked": is_blocked,
        "can_view_profile": can_view_profile,
        "posts": await posts_public(db, posts, viewer),
        "communities": [community_public(item) for item in communities],
        "collections": [await collection_public(db, item, viewer) for item in collections],
        "liked_posts": await posts_public(db, liked_posts, viewer),
        "reposted_posts": await posts_public(db, reposted_posts, viewer),
    }




@router.post("/api/users/{username}/follow")
async def follow_user(username: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    target = await db.scalar(select(User).where(User.username == username.lstrip("@").lower()))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    existing = await db.scalar(select(Follow).where(Follow.follower_id == user.id, Follow.following_id == target.id))
    if not existing:
        db.add(Follow(follower_id=user.id, following_id=target.id))
        user.following_count += 1
        target.followers_count += 1
        await notify(db, target.id, "follow", {"actor_id": user.id, "actor": user.display_name})
    await db.commit()
    return {"success": True, "is_following": True}




@router.delete("/api/users/{username}/follow")
async def unfollow_user(username: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    target = await db.scalar(select(User).where(User.username == username.lstrip("@").lower()))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.scalar(select(Follow).where(Follow.follower_id == user.id, Follow.following_id == target.id))
    if existing:
        await db.delete(existing)
        user.following_count = max(0, user.following_count - 1)
        target.followers_count = max(0, target.followers_count - 1)
    await db.commit()
    return {"success": True, "is_following": False}




@router.get("/api/users/{username}/followers")
async def followers(username: str, db: AsyncSession = Depends(get_session), viewer: User | None = Depends(get_optional_user)):
    target = await db.scalar(select(User).where(User.username == username.lstrip("@").lower()))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not await _can_view_profile(db, target, viewer):
        raise HTTPException(status_code=404, detail="User not found")
    rows = (await db.scalars(select(Follow).where(Follow.following_id == target.id))).all()
    users = [await db.get(User, row.follower_id) for row in rows]
    return [user_public(item) for item in users if item]



@router.get("/api/users/{username}/following")
async def following(username: str, db: AsyncSession = Depends(get_session), viewer: User | None = Depends(get_optional_user)):
    target = await db.scalar(select(User).where(User.username == username.lstrip("@").lower()))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if not await _can_view_profile(db, target, viewer):
        raise HTTPException(status_code=404, detail="User not found")
    rows = (await db.scalars(select(Follow).where(Follow.follower_id == target.id))).all()
    users = [await db.get(User, row.following_id) for row in rows]
    return [user_public(item) for item in users if item]






@router.post("/api/users/{username}/block")
async def block_user(username: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    target = await db.scalar(select(User).where(User.username == username.lstrip("@").lower()))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    existing = await db.scalar(select(UserBlock).where(UserBlock.blocker_id == user.id, UserBlock.blocked_id == target.id))
    if not existing:
        db.add(UserBlock(blocker_id=user.id, blocked_id=target.id))
    await db.commit()
    return {"success": True, "is_blocked": True}




@router.delete("/api/users/{username}/block")
async def unblock_user(username: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    target = await db.scalar(select(User).where(User.username == username.lstrip("@").lower()))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.scalar(select(UserBlock).where(UserBlock.blocker_id == user.id, UserBlock.blocked_id == target.id))
    if existing:
        await db.delete(existing)
    await db.commit()
    return {"success": True, "is_blocked": False}
