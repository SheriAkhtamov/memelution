from __future__ import annotations

import json
import secrets
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import case, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.auth import (
    get_current_user,
    get_optional_user,
)
from app.db.session import get_session
from app.models import (
    CollectionPost, Community, CommunityMember,
    Follow, Hashtag, Like, MediaFile, PollVote, Post, PostHashtag, PostHide, Reaction, Report, Repost, Save, SaveCollection,
    User, UserBlock, now,
)
from app.schemas import (
    PinPostPayload, PollVotePayload, PostReportPayload,
    PostUpdatePayload, RepostPayload, SaveToCollectionPayload,
)
from app.services.api_support import *  # noqa: F403
from app.services.feed_service import engagement_score, normalize_interest_tags
from app.services.media import save_upload

router = APIRouter()


POST_VISIBILITIES = {"public", "followers", "private"}


def _visible_posts_query(query, viewer: User | None):
    if not viewer:
        return query.where(Post.visibility == "public")
    followed_authors = select(Follow.following_id).where(Follow.follower_id == viewer.id)
    return query.where(
        or_(
            Post.visibility == "public",
            Post.author_id == viewer.id,
            (Post.visibility == "followers") & Post.author_id.in_(followed_authors),
        )
    )

@router.post("/api/media")
async def upload_media(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    file_url, size, file_type = await save_upload(file, user.id)
    media = MediaFile(user_id=user.id, file_url=file_url, file_type=file_type, file_size=size)
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return {
        "id": media.id,
        "url": absolutize(file_url),
        "file_url": absolutize(file_url),
        "file_type": file_type,
        "file_size": size,
    }


@router.get("/api/posts")
async def feed(
    feed: str = Query("for-you"),
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    offset: int = Query(0, ge=0),
    community_id: str | None = None,
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    query = _visible_posts_query(select(Post).where(Post.is_deleted.is_(False), Post.status == "published"), viewer)
    if viewer:
        hidden_posts = select(PostHide.post_id).where(PostHide.user_id == viewer.id)
        blocked_authors = select(UserBlock.blocked_id).where(UserBlock.blocker_id == viewer.id)
        blocked_by = select(UserBlock.blocker_id).where(UserBlock.blocked_id == viewer.id)
        query = query.where(Post.id.not_in(hidden_posts), Post.author_id.not_in(blocked_authors), Post.author_id.not_in(blocked_by))
    if community_id:
        query = query.where(Post.community_id == community_id)

    tab = feed if feed in {"for-you", "following", "popular", "new", "memes", "video", "polls", "communities", "local"} else "for-you"
    score = engagement_score()

    if tab == "following" and viewer:
        follows = (await db.scalars(select(Follow.following_id).where(Follow.follower_id == viewer.id))).all()
        member_communities = (
            await db.scalars(
                select(CommunityMember.community_id).where(
                    CommunityMember.user_id == viewer.id, CommunityMember.status == "active"
                )
            )
        ).all()
        if follows or member_communities:
            query = query.where(or_(Post.author_id.in_(follows), Post.community_id.in_(member_communities)))
        else:
            query = query.where(Post.id == "__empty__")
    elif tab == "popular":
        query = query.order_by(desc(score), desc(Post.created_at), desc(Post.id))
    elif tab == "memes":
        query = query.where(Post.type == "meme")
    elif tab == "video":
        query = query.where(Post.type == "video")
    elif tab == "polls":
        query = query.where(Post.type == "poll")
    elif tab == "communities" and viewer:
        member_communities = (
            await db.scalars(
                select(CommunityMember.community_id).where(
                    CommunityMember.user_id == viewer.id, CommunityMember.status == "active"
                )
            )
        ).all()
        query = query.where(Post.community_id.in_(member_communities)) if member_communities else query.where(Post.id == "__empty__")
    elif tab == "local" and viewer and viewer.location:
        authors = (await db.scalars(select(User.id).where(User.location == viewer.location))).all()
        query = query.where(Post.author_id.in_(authors)) if authors else query.where(Post.id == "__empty__")

    if tab == "for-you":
        if viewer and viewer.interests:
            interest_tags = normalize_interest_tags(viewer.interests)
            matching_posts = (
                await db.scalars(
                    select(PostHashtag.post_id)
                    .join(Hashtag, Hashtag.id == PostHashtag.hashtag_id)
                    .where(Hashtag.name.in_(interest_tags))
                )
            ).all()
            followed_authors = (await db.scalars(select(Follow.following_id).where(Follow.follower_id == viewer.id))).all()
            community_ids = (
                await db.scalars(
                    select(CommunityMember.community_id).where(
                        CommunityMember.user_id == viewer.id,
                        CommunityMember.status == "active",
                    )
                )
            ).all()
            priority = []
            if matching_posts:
                priority.append(Post.id.in_(matching_posts))
            if followed_authors:
                priority.append(Post.author_id.in_(followed_authors))
            if community_ids:
                priority.append(Post.community_id.in_(community_ids))
            if priority:
                query = query.order_by(desc(case((or_(*priority), 1), else_=0)), desc(score), desc(Post.created_at), desc(Post.id))
            else:
                query = query.order_by(desc(score), desc(Post.created_at), desc(Post.id))
        else:
            query = query.order_by(desc(score), desc(Post.created_at), desc(Post.id))
    elif tab not in {"popular"}:
        query = query.order_by(desc(Post.created_at), desc(Post.id))

    uses_score_cursor = tab in {"for-you", "popular"}
    query = apply_desc_cursor(query, Post, cursor, score_expr=score if uses_score_cursor else None)
    rows = (await db.scalars(query.limit(limit + 1))).all()
    items = rows[:limit]
    next_cursor = encode_cursor(cursor_for_post(items[-1], include_score=uses_score_cursor)) if items and len(rows) > limit else None
    return {
        "items": await posts_public(db, items, viewer),
        "limit": limit,
        "cursor": cursor,
        "next_cursor": next_cursor,
        "has_more": bool(next_cursor),
    }




@router.post("/api/posts")
async def create_post(
    text: str = Form(""),
    type: str = Form("text"),
    community_id: str | None = Form(None),
    parent_post_id: str | None = Form(None),
    media_alt: str | None = Form(None),
    visibility: str = Form("public"),
    comments_enabled: bool = Form(True),
    poll_options: str | None = Form(None),
    poll_settings: str | None = Form(None),
    media: UploadFile | None = File(None),
    media_files: list[UploadFile] | None = File(None),
    status: str = Form("published"),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    ensure_not_restricted(user, "posts")
    if type not in {"text", "meme", "video", "poll", "quote"}:
        raise HTTPException(status_code=422, detail="Invalid post type")
    upload_files = [item for item in [media, *(media_files or [])] if item is not None]
    if status not in {"published", "draft"}:
        raise HTTPException(status_code=422, detail="Invalid post status")
    if visibility not in POST_VISIBILITIES:
        raise HTTPException(status_code=422, detail="Invalid post visibility")
    if not text and not upload_files and type != "poll":
        raise HTTPException(status_code=422, detail="Post text or media is required")
    if type == "text" and len(text) > 500:
        raise HTTPException(status_code=422, detail="Text post limit is 500 characters")
    if community_id:
        community = await db.get(Community, community_id)
        if not community or community.is_banned:
            raise HTTPException(status_code=404, detail="Community not found")
        member = await db.scalar(
            select(CommunityMember).where(
                CommunityMember.community_id == community_id,
                CommunityMember.user_id == user.id,
                CommunityMember.status == "active",
            )
        )
        if not member and user.role != "global_admin":
            raise HTTPException(status_code=403, detail="Join community before posting")
    media_url = None
    media_type = None
    media_items: list[dict[str, Any]] = []
    for index, upload in enumerate(upload_files):
        item_url, size, item_type = await save_upload(upload, user.id)
        db.add(MediaFile(user_id=user.id, file_url=item_url, file_type=item_type, file_size=size))
        media_items.append(
            {
                "id": secrets.token_hex(8),
                "url": item_url,
                "type": item_type,
                "alt": media_alt or "",
                "name": upload.filename,
                "size": size,
            }
        )
        if index == 0:
            media_url, media_type = item_url, item_type
        if type == "text":
            type = "meme" if item_type.startswith("image/") else "video"
    parsed_poll: list[dict[str, Any]] = []
    parsed_poll_settings: dict[str, Any] = {}
    if type == "poll":
        try:
            parsed_poll = json.loads(poll_options or "[]")
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="Invalid poll options JSON") from exc
        if not 2 <= len(parsed_poll) <= 6:
            raise HTTPException(status_code=422, detail="Poll must have 2-6 options")
        parsed_poll = [
            {"id": str(index + 1), "text": str(option.get("text", option))[:120], "votes": 0}
            for index, option in enumerate(parsed_poll)
        ]
        try:
            parsed_poll_settings = json.loads(poll_settings or "{}")
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="Invalid poll settings JSON") from exc
        if parsed_poll_settings.get("results") not in {None, "always", "after_vote"}:
            raise HTTPException(status_code=422, detail="Invalid poll results setting")
    post = Post(
        author_id=user.id,
        community_id=community_id,
        parent_post_id=parent_post_id,
        type=type,
        text=text,
        media_url=media_url,
        media_type=media_type,
        media_alt=media_alt,
        media_items=media_items,
        poll_options=parsed_poll,
        poll_settings=parsed_poll_settings,
        visibility=visibility,
        status=status,
        comments_enabled=comments_enabled,
    )
    db.add(post)
    user.posts_count += 1
    if community_id:
        community = await db.get(Community, community_id)
        if community:
            community.posts_count += 1
    await db.flush()
    await sync_hashtags(db, post)
    await db.commit()
    await db.refresh(post)
    return await post_public(db, post, user)




@router.get("/api/posts/{post_id}")
async def post_detail(
    post_id: str,
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status != "published" and (not viewer or viewer.id != post.author_id):
        raise HTTPException(status_code=404, detail="Post not found")
    can_view = (
        post.visibility == "public"
        or (viewer and viewer.id == post.author_id)
        or (
            post.visibility == "followers"
            and viewer
            and await db.scalar(select(Follow).where(Follow.follower_id == viewer.id, Follow.following_id == post.author_id))
        )
    )
    if not can_view:
        raise HTTPException(status_code=404, detail="Post not found")
    comments_payload = await comments_for_post(post_id, "popular", 20, None, db, viewer)
    hashtag_ids = (await db.scalars(select(PostHashtag.hashtag_id).where(PostHashtag.post_id == post_id))).all()
    related: list[Post] = []
    if hashtag_ids:
        related_ids = (
            await db.scalars(
                select(PostHashtag.post_id)
                .where(PostHashtag.hashtag_id.in_(hashtag_ids), PostHashtag.post_id != post_id)
                .limit(24)
            )
        ).all()
        if related_ids:
            related = (
                await db.scalars(
                    select(Post)
                    .where(Post.id.in_(related_ids), Post.is_deleted.is_(False))
                    .order_by(desc(Post.likes_count + Post.comments_count * 2), desc(Post.created_at))
                    .limit(6)
                )
            ).all()
    return {
        "post": await post_public(db, post, viewer),
        "comments": comments_payload["items"],
        "comments_next_cursor": comments_payload["next_cursor"],
        "related": [await post_public(db, item, viewer) for item in related],
    }




@router.patch("/api/posts/{post_id}")
async def update_post(
    post_id: str,
    payload: PostUpdatePayload = Depends(PostUpdatePayload.as_form),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != user.id and user.role not in {"global_admin", "admin"}:
        raise HTTPException(status_code=403, detail="Cannot edit this post")
    next_hashtags = {match.group(1).lower() for match in HASHTAG_RE.finditer(payload.text or "")}
    current_links = (
        await db.scalars(
            select(PostHashtag)
            .join(Hashtag, Hashtag.id == PostHashtag.hashtag_id)
            .where(PostHashtag.post_id == post.id)
        )
    ).all()
    for link in current_links:
        tag = await db.get(Hashtag, link.hashtag_id)
        if tag and tag.name not in next_hashtags:
            tag.posts_count = max(0, tag.posts_count - 1)
            await db.delete(link)
    post.text = payload.text
    post.comments_enabled = payload.comments_enabled
    await sync_hashtags(db, post)
    await db.commit()
    return await post_public(db, post, user)




@router.delete("/api/posts/{post_id}")
async def delete_post(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    was_admin_delete = post.author_id != user.id and user.role in {"global_admin", "admin"}
    if post.author_id != user.id and user.role not in {"global_admin", "admin"}:
        if post.community_id:
            await require_community_manager(db, post.community_id, user)
        else:
            raise HTTPException(status_code=403, detail="Cannot delete this post")
    post.is_deleted = True
    author = await db.get(User, post.author_id)
    if author:
        author.posts_count = max(0, author.posts_count - 1)
    if post.community_id:
        community = await db.get(Community, post.community_id)
        if community:
            community.posts_count = max(0, community.posts_count - 1)
    if was_admin_delete:
        await notify(
            db,
            post.author_id,
            "post_removed",
            {"post_id": post.id, "reason": "Пост удалён за нарушение правил сайта.", "moderator": user.display_name},
        )
    await db.commit()
    return {"success": True}


@router.post("/api/posts/{post_id}/restore")
async def restore_post(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != user.id and user.role not in {"global_admin", "admin"}:
        if post.community_id:
            await require_community_manager(db, post.community_id, user)
        else:
            raise HTTPException(status_code=403, detail="Cannot restore this post")
    if post.is_deleted:
        post.is_deleted = False
        author = await db.get(User, post.author_id)
        if author:
            author.posts_count += 1
        if post.community_id:
            community = await db.get(Community, post.community_id)
            if community:
                community.posts_count += 1
        await db.commit()
    return {"success": True, "post": await post_public(db, post, user)}




@router.post("/api/posts/{post_id}/like")
async def like_post(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.scalar(
        select(Like).where(Like.user_id == user.id, Like.target_type == "post", Like.target_id == post_id)
    )
    if not existing:
        db.add(Like(user_id=user.id, target_type="post", target_id=post_id))
        post.likes_count += 1
        if post.author_id != user.id:
            await notify(db, post.author_id, "post_liked", {"post_id": post.id, "actor": user.display_name})
    await db.commit()
    return {"success": True, "liked": True, "likes_count": post.likes_count}




@router.delete("/api/posts/{post_id}/like")
async def unlike_post(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.scalar(
        select(Like).where(Like.user_id == user.id, Like.target_type == "post", Like.target_id == post_id)
    )
    if existing:
        await db.delete(existing)
        post.likes_count = max(0, post.likes_count - 1)
    await db.commit()
    return {"success": True, "liked": False, "likes_count": post.likes_count}


ALLOWED_REACTIONS = {"😂", "❤️", "🔥", "😢", "😡", "👏", "💀", "🤡"}


@router.post("/api/posts/{post_id}/reactions")
async def add_reaction(
    post_id: str,
    emoji: str = Query(..., max_length=8),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if emoji not in ALLOWED_REACTIONS:
        raise HTTPException(status_code=422, detail=f"Unsupported reaction emoji. Allowed: {', '.join(ALLOWED_REACTIONS)}")
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.scalar(
        select(Reaction).where(Reaction.user_id == user.id, Reaction.post_id == post_id, Reaction.emoji == emoji)
    )
    if not existing:
        db.add(Reaction(user_id=user.id, post_id=post_id, emoji=emoji))
    await db.commit()
    return {"success": True, "reactions": await _reactions_summary(db, post_id, user)}


@router.delete("/api/posts/{post_id}/reactions")
async def remove_reaction(
    post_id: str,
    emoji: str = Query(..., max_length=8),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.scalar(
        select(Reaction).where(Reaction.user_id == user.id, Reaction.post_id == post_id, Reaction.emoji == emoji)
    )
    if existing:
        await db.delete(existing)
    await db.commit()
    return {"success": True, "reactions": await _reactions_summary(db, post_id, user)}


async def _reactions_summary(db: AsyncSession, post_id: str, viewer: User | None) -> list[dict]:
    """Return reactions grouped by emoji with counts and viewer's own reactions."""
    rows = (await db.execute(
        select(Reaction.emoji, func.count(Reaction.id).label("cnt"))
        .where(Reaction.post_id == post_id)
        .group_by(Reaction.emoji)
    )).all()
    viewer_emojis: set[str] = set()
    if viewer:
        viewer_emojis = set(
            (await db.scalars(
                select(Reaction.emoji).where(Reaction.post_id == post_id, Reaction.user_id == viewer.id)
            )).all()
        )
    return [{"emoji": row.emoji, "count": row.cnt, "reacted": row.emoji in viewer_emojis} for row in rows]



@router.post("/api/posts/{post_id}/repost")
async def repost_post(
    post_id: str,
    payload: RepostPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.scalar(select(Repost).where(Repost.user_id == user.id, Repost.post_id == post_id))
    if not existing:
        db.add(Repost(user_id=user.id, post_id=post_id, comment=payload.comment))
        post.reposts_count += 1
        if payload.comment:
            quote = Post(
                author_id=user.id,
                community_id=payload.community_id,
                parent_post_id=post.id,
                type="quote",
                text=payload.comment,
            )
            db.add(quote)
        if post.author_id != user.id:
            await notify(db, post.author_id, "post_reposted", {"post_id": post.id, "actor": user.display_name})
    await db.commit()
    return {"success": True, "reposted": True, "reposts_count": post.reposts_count}




@router.delete("/api/posts/{post_id}/repost")
async def unrepost_post(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.scalar(select(Repost).where(Repost.user_id == user.id, Repost.post_id == post_id))
    if existing:
        await db.delete(existing)
        post.reposts_count = max(0, post.reposts_count - 1)
    quotes = (
        await db.scalars(
            select(Post).where(Post.author_id == user.id, Post.parent_post_id == post_id, Post.type == "quote", Post.is_deleted.is_(False))
        )
    ).all()
    for quote in quotes:
        quote.is_deleted = True
    await db.commit()
    return {"success": True, "reposted": False, "reposts_count": post.reposts_count}




@router.post("/api/posts/{post_id}/save")
async def save_post(
    post_id: str,
    payload: SaveToCollectionPayload | None = None,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    collection = await db.get(SaveCollection, payload.collection_id) if payload and payload.collection_id else None
    if collection and collection.user_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot save to this collection")
    if not collection:
        collection = await db.scalar(
            select(SaveCollection).where(SaveCollection.user_id == user.id, SaveCollection.name == "Все сохранённые")
        )
        if not collection:
            collection = SaveCollection(user_id=user.id, name="Все сохранённые")
            db.add(collection)
            await db.flush()
    existing = await db.scalar(select(Save).where(Save.user_id == user.id, Save.post_id == post_id))
    if not existing:
        db.add(Save(user_id=user.id, post_id=post_id, collection_id=collection.id))
        db.add(CollectionPost(collection_id=collection.id, post_id=post_id))
        post.saves_count += 1
    elif existing.collection_id != collection.id:
        if existing.collection_id:
            old = await db.scalar(
                select(CollectionPost).where(CollectionPost.collection_id == existing.collection_id, CollectionPost.post_id == post_id)
            )
            if old:
                await db.delete(old)
        existing.collection_id = collection.id
        collection_post = await db.scalar(
            select(CollectionPost).where(CollectionPost.collection_id == collection.id, CollectionPost.post_id == post_id)
        )
        if not collection_post:
            db.add(CollectionPost(collection_id=collection.id, post_id=post_id))
    await db.commit()
    return {"success": True, "saved": True, "saves_count": post.saves_count}




@router.delete("/api/posts/{post_id}/save")
async def unsave_post(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.scalar(select(Save).where(Save.user_id == user.id, Save.post_id == post_id))
    if existing:
        if existing.collection_id:
            collection_post = await db.scalar(
                select(CollectionPost).where(CollectionPost.collection_id == existing.collection_id, CollectionPost.post_id == post_id)
            )
            if collection_post:
                await db.delete(collection_post)
        await db.delete(existing)
        post.saves_count = max(0, post.saves_count - 1)
    await db.commit()
    return {"success": True, "saved": False, "saves_count": post.saves_count}




@router.post("/api/posts/{post_id}/hide")
async def hide_post(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.scalar(select(PostHide).where(PostHide.user_id == user.id, PostHide.post_id == post_id))
    if not existing:
        db.add(PostHide(user_id=user.id, post_id=post_id))
    await db.commit()
    return {"success": True, "hidden": True}


@router.delete("/api/posts/{post_id}/hide")
async def unhide_post(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    existing = await db.scalar(select(PostHide).where(PostHide.user_id == user.id, PostHide.post_id == post_id))
    if existing:
        await db.delete(existing)
        await db.commit()
    return {"success": True, "hidden": False}




@router.post("/api/posts/{post_id}/report")
async def report_post(
    post_id: str,
    payload: PostReportPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    report = Report(
        reporter_id=user.id,
        target_type="post",
        target_id=post_id,
        reason=payload.reason,
        description=payload.description,
    )
    db.add(report)
    await db.commit()
    return {"id": report.id, "status": report.status}




@router.post("/api/posts/{post_id}/pin")
async def pin_post(
    post_id: str,
    payload: PinPostPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    can_pin_profile = payload.scope == "profile" and post.author_id == user.id
    can_pin_community = False
    if payload.scope == "community" and post.community_id:
        await require_community_manager(db, post.community_id, user)
        can_pin_community = True
    if not can_pin_profile and not can_pin_community and user.role not in {"global_admin", "admin"}:
        raise HTTPException(status_code=403, detail="Cannot pin this post")
    if payload.pinned:
        if payload.scope == "profile":
            old_posts = (await db.scalars(select(Post).where(Post.author_id == post.author_id, Post.is_pinned.is_(True)))).all()
        else:
            old_posts = (
                await db.scalars(select(Post).where(Post.community_id == post.community_id, Post.is_pinned.is_(True)))
            ).all()
        for old in old_posts:
            old.is_pinned = False
    post.is_pinned = payload.pinned
    await db.commit()
    return {"success": True, "post": await post_public(db, post, user)}




@router.post("/api/posts/{post_id}/poll/vote")
async def vote_poll(
    post_id: str,
    payload: PollVotePayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted or post.type != "poll":
        raise HTTPException(status_code=404, detail="Poll not found")
    options = [dict(option) for option in (post.poll_options or [])]
    if payload.option_id not in {str(option.get("id")) for option in options}:
        raise HTTPException(status_code=422, detail="Poll option not found")
    existing = await db.scalar(select(PollVote).where(PollVote.post_id == post_id, PollVote.user_id == user.id))
    if existing and existing.option_id == payload.option_id:
        return {"success": True, "post": await post_public(db, post, user)}
    if existing:
        for option in options:
            if str(option.get("id")) == existing.option_id:
                option["votes"] = max(0, int(option.get("votes", 0)) - 1)
        existing.option_id = payload.option_id
    else:
        db.add(PollVote(post_id=post_id, option_id=payload.option_id, user_id=user.id))
    for option in options:
        if str(option.get("id")) == payload.option_id:
            option["votes"] = int(option.get("votes", 0)) + 1
    post.poll_options = options
    flag_modified(post, "poll_options")
    await db.commit()
    await db.refresh(post)
    return {"success": True, "post": await post_public(db, post, user)}




@router.delete("/api/posts/{post_id}/poll/vote")
async def unvote_poll(post_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    post = await db.get(Post, post_id)
    if not post or post.is_deleted or post.type != "poll":
        raise HTTPException(status_code=404, detail="Poll not found")
    existing = await db.scalar(select(PollVote).where(PollVote.post_id == post_id, PollVote.user_id == user.id))
    if existing:
        options = [dict(option) for option in (post.poll_options or [])]
        for option in options:
            if str(option.get("id")) == existing.option_id:
                option["votes"] = max(0, int(option.get("votes", 0)) - 1)
        post.poll_options = options
        flag_modified(post, "poll_options")
        await db.delete(existing)
    await db.commit()
    await db.refresh(post)
    return {"success": True, "post": await post_public(db, post, user)}




@router.get("/api/trends")
async def trends(
    period: str = Query("day", pattern="^(day|week)$"),
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    since = now() - timedelta(days=7 if period == "week" else 1)
    hashtags = (
        await db.scalars(select(Hashtag).order_by(desc(Hashtag.posts_count), Hashtag.name).limit(10))
    ).all()
    public_posts = select(Post).where(Post.is_deleted.is_(False), Post.status == "published", Post.created_at >= since)
    rising_posts = (
        await db.scalars(
            public_posts
            .order_by(desc(Post.likes_count + Post.comments_count * 2 + Post.reposts_count * 3 + Post.saves_count * 3), desc(Post.created_at))
            .limit(8)
        )
    ).all()
    discussed_posts = (
        await db.scalars(
            public_posts.order_by(desc(Post.comments_count), desc(Post.created_at)).limit(6)
        )
    ).all()
    active_communities = (
        await db.scalars(select(Community).where(Community.is_banned.is_(False)).order_by(desc(Community.posts_count), desc(Community.members_count)).limit(8))
    ).all()
    authors = (
        await db.scalars(select(User).order_by(desc(User.followers_count), desc(User.posts_count), desc(User.created_at)).limit(8))
    ).all()
    polls = (
        await db.scalars(public_posts.where(Post.type == "poll").order_by(desc(Post.created_at)).limit(6))
    ).all()
    return {
        "hashtags": [{"id": item.id, "name": item.name, "posts_count": item.posts_count} for item in hashtags],
        "rising_posts": [await post_public(db, item, viewer) for item in rising_posts],
        "active_communities": [community_public(item) for item in active_communities],
        "discussed_posts": [await post_public(db, item, viewer) for item in discussed_posts],
        "popular_authors": [user_public(item) for item in authors],
        "popular_polls": [await post_public(db, item, viewer) for item in polls],
    }
