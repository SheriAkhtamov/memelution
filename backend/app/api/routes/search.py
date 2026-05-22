from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_user,
    get_optional_user,
)
from app.db.session import get_session
from app.models import (
    Community, Follow, Hashtag, HashtagFollow, Post, PostHashtag, User,
)
from app.services.api_support import *  # noqa: F403
from app.services.feed_service import engagement_score

router = APIRouter()


def _normalize_search_query(q: str, type: str = "all") -> str:
    value = q.strip()[:120].lower()
    if type in {"people", "all"} and value.startswith("@"):
        return value[1:].strip()
    if type in {"hashtags", "all"} and value.startswith("#"):
        return value[1:].strip()
    return value


@router.get("/api/search")
async def search(
    q: str,
    type: str = "all",
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    q = _normalize_search_query(q, type)
    if not q:
        return {"people": [], "posts": [], "communities": [], "hashtags": []}
    needle = f"%{q.lower()}%"
    prefix = f"{q.lower()}%"
    result: dict[str, Any] = {}
    if type in {"all", "people"}:
        users = (
            await db.scalars(
                select(User)
                .where(or_(func.lower(User.username).like(needle), func.lower(User.display_name).like(needle)))
                .order_by(
                    desc(case((func.lower(User.username).like(prefix), 3), (func.lower(User.display_name).like(prefix), 2), else_=1)),
                    desc(User.followers_count),
                )
                .limit(20)
            )
        ).all()
        result["people"] = [user_public(item) for item in users]
    if type in {"all", "posts", "media", "memes", "video"}:
        score = engagement_score()
        query = select(Post).where(Post.is_deleted.is_(False), Post.status == "published", func.lower(Post.text).like(needle))
        if viewer:
            followed_authors = select(Follow.following_id).where(Follow.follower_id == viewer.id)
            query = query.where(
                or_(
                    Post.visibility == "public",
                    Post.author_id == viewer.id,
                    (Post.visibility == "followers") & Post.author_id.in_(followed_authors),
                )
            )
        else:
            query = query.where(Post.visibility == "public")
        if type == "media":
            query = query.where(Post.media_url.is_not(None))
        if type == "memes":
            query = query.where(Post.type == "meme")
        if type == "video":
            query = query.where(Post.type == "video")
        posts = (
            await db.scalars(
                query.order_by(desc(case((func.lower(Post.text).like(prefix), 2), else_=1)), desc(score), desc(Post.created_at)).limit(30)
            )
        ).all()
        result["posts"] = await posts_public(db, posts, viewer)
    if type in {"all", "communities"}:
        communities = (
            await db.scalars(
                select(Community).where(
                    or_(func.lower(Community.name).like(needle), func.lower(Community.description).like(needle))
                )
                .order_by(
                    desc(case((func.lower(Community.name).like(prefix), 3), else_=1)),
                    desc(Community.members_count),
                )
                .limit(20)
            )
        ).all()
        result["communities"] = [community_public(item) for item in communities]
    if type in {"all", "hashtags"}:
        hashtags = (
            await db.scalars(
                select(Hashtag)
                .where(func.lower(Hashtag.name).like(needle))
                .order_by(desc(case((func.lower(Hashtag.name).like(prefix), 2), else_=1)), desc(Hashtag.posts_count))
                .limit(20)
            )
        ).all()
        result["hashtags"] = [{"id": item.id, "name": item.name, "posts_count": item.posts_count} for item in hashtags]
    return result


@router.get("/api/search/autocomplete")
async def search_autocomplete(q: str = "", db: AsyncSession = Depends(get_session)):
    q = _normalize_search_query(q)
    if not q:
        hashtags = (await db.scalars(select(Hashtag).order_by(desc(Hashtag.posts_count), Hashtag.name).limit(8))).all()
        communities = (await db.scalars(select(Community).where(Community.is_banned.is_(False)).order_by(desc(Community.members_count)).limit(5))).all()
        return {
            "queries": [f"#{item.name}" for item in hashtags],
            "communities": [community_public(item) for item in communities],
            "people": [],
            "hashtags": [{"id": item.id, "name": item.name, "posts_count": item.posts_count} for item in hashtags],
        }
    needle = f"{q}%"
    people = (
        await db.scalars(
            select(User)
            .where(or_(func.lower(User.username).like(needle), func.lower(User.display_name).like(needle)))
            .order_by(desc(User.followers_count))
            .limit(5)
        )
    ).all()
    communities = (
        await db.scalars(
            select(Community)
            .where(Community.is_banned.is_(False), func.lower(Community.name).like(needle))
            .order_by(desc(Community.members_count))
            .limit(5)
        )
    ).all()
    hashtags = (
        await db.scalars(select(Hashtag).where(func.lower(Hashtag.name).like(needle)).order_by(desc(Hashtag.posts_count)).limit(8))
    ).all()
    return {
        "queries": [f"#{item.name}" for item in hashtags] + [f"@{item.username}" for item in people],
        "people": [user_public(item) for item in people],
        "communities": [community_public(item) for item in communities],
        "hashtags": [{"id": item.id, "name": item.name, "posts_count": item.posts_count} for item in hashtags],
    }




@router.get("/api/hashtags/{name}")
async def hashtag_detail(
    name: str,
    tab: str = "popular",
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    tag = await db.scalar(select(Hashtag).where(func.lower(Hashtag.name) == name.lstrip("#").lower()))
    if not tag:
        raise HTTPException(status_code=404, detail="Hashtag not found")
    post_ids = (await db.scalars(select(PostHashtag.post_id).where(PostHashtag.hashtag_id == tag.id))).all()
    query = (
        select(Post).where(Post.id.in_(post_ids), Post.is_deleted.is_(False), Post.status == "published")
        if post_ids
        else select(Post).where(Post.id == "__empty__")
    )
    if tab == "new":
        query = query.order_by(desc(Post.created_at))
    elif tab == "media":
        query = query.where(Post.media_url.is_not(None)).order_by(desc(Post.created_at))
    elif tab == "video":
        query = query.where(Post.type == "video").order_by(desc(Post.created_at))
    else:
        query = query.order_by(desc(Post.likes_count + Post.comments_count * 2 + Post.reposts_count * 3), desc(Post.created_at))
    posts = (await db.scalars(query.limit(40))).all()
    related = (
        await db.scalars(
            select(Hashtag)
            .where(Hashtag.id != tag.id)
            .order_by(desc(Hashtag.posts_count), Hashtag.name)
            .limit(8)
        )
    ).all()
    is_following = False
    if viewer:
        is_following = bool(
            await db.scalar(select(HashtagFollow).where(HashtagFollow.user_id == viewer.id, HashtagFollow.hashtag_id == tag.id))
        )
    return {
        "hashtag": {"id": tag.id, "name": tag.name, "posts_count": tag.posts_count, "is_following": is_following},
        "posts": await posts_public(db, posts, viewer),
        "related": [{"id": item.id, "name": item.name, "posts_count": item.posts_count} for item in related],
    }




@router.post("/api/hashtags/{name}/follow")
async def follow_hashtag(name: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    tag = await db.scalar(select(Hashtag).where(func.lower(Hashtag.name) == name.lstrip("#").lower()))
    if not tag:
        tag = Hashtag(name=name.lstrip("#").lower(), posts_count=0)
        db.add(tag)
        await db.flush()
    existing = await db.scalar(select(HashtagFollow).where(HashtagFollow.user_id == user.id, HashtagFollow.hashtag_id == tag.id))
    if not existing:
        db.add(HashtagFollow(user_id=user.id, hashtag_id=tag.id))
    await db.commit()
    return {"success": True, "is_following": True}




@router.delete("/api/hashtags/{name}/follow")
async def unfollow_hashtag(name: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    tag = await db.scalar(select(Hashtag).where(func.lower(Hashtag.name) == name.lstrip("#").lower()))
    if not tag:
        raise HTTPException(status_code=404, detail="Hashtag not found")
    existing = await db.scalar(select(HashtagFollow).where(HashtagFollow.user_id == user.id, HashtagFollow.hashtag_id == tag.id))
    if existing:
        await db.delete(existing)
    await db.commit()
    return {"success": True, "is_following": False}
