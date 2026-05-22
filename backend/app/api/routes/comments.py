from __future__ import annotations


from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_user,
    get_optional_user,
)
from app.db.session import get_session
from app.models import (
    Comment, Like, Post, User,
)
from app.schemas import (
    CommentPayload, UpdateCommentPayload,
)
from app.services.api_support import *  # noqa: F403

router = APIRouter()

@router.get("/api/posts/{post_id}/comments")
async def get_comments(
    post_id: str,
    sort: str = "popular",
    limit: int = Query(30, ge=1, le=100),
    cursor: str | None = None,
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    return await comments_for_post(post_id, sort, limit, cursor, db, viewer)




@router.post("/api/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    payload: CommentPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    ensure_not_restricted(user, "comments")
    post = await db.get(Post, post_id)
    if not post or post.is_deleted:
        raise HTTPException(status_code=404, detail="Post not found")
    if not post.comments_enabled:
        raise HTTPException(status_code=403, detail="Comments are disabled")
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="Comment text is required")
    if payload.parent_comment_id:
        parent = await db.get(Comment, payload.parent_comment_id)
        if not parent or parent.post_id != post_id:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        if parent.is_deleted or parent.hidden_by_moderator:
            raise HTTPException(status_code=403, detail="Cannot reply to this comment")
    comment = Comment(
        post_id=post_id,
        author_id=user.id,
        parent_comment_id=payload.parent_comment_id,
        text=payload.text.strip(),
    )
    db.add(comment)
    post.comments_count += 1
    recipient_id = post.author_id
    if payload.parent_comment_id:
        parent = await db.get(Comment, payload.parent_comment_id)
        recipient_id = parent.author_id if parent else recipient_id
    if recipient_id != user.id:
        await notify(db, recipient_id, "comment", {"post_id": post.id, "actor": user.display_name})
    await db.commit()
    await db.refresh(comment)
    return await comment_public(db, comment, user)




@router.post("/api/comments/{comment_id}/like")
async def like_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    comment = await db.get(Comment, comment_id)
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")
    existing = await db.scalar(
        select(Like).where(Like.user_id == user.id, Like.target_type == "comment", Like.target_id == comment_id)
    )
    if not existing:
        db.add(Like(user_id=user.id, target_type="comment", target_id=comment_id))
        comment.likes_count += 1
    await db.commit()
    return {"success": True, "liked": True, "likes_count": comment.likes_count}




@router.delete("/api/comments/{comment_id}/like")
async def unlike_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    comment = await db.get(Comment, comment_id)
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")
    existing = await db.scalar(
        select(Like).where(Like.user_id == user.id, Like.target_type == "comment", Like.target_id == comment_id)
    )
    if existing:
        await db.delete(existing)
        comment.likes_count = max(0, comment.likes_count - 1)
    await db.commit()
    return {"success": True, "liked": False, "likes_count": comment.likes_count}




@router.patch("/api/comments/{comment_id}")
async def update_comment(
    comment_id: str,
    payload: UpdateCommentPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    comment = await db.get(Comment, comment_id)
    if not comment or comment.is_deleted:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != user.id and user.role not in {"global_admin", "admin"}:
        raise HTTPException(status_code=403, detail="Cannot edit this comment")
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="Comment text is required")
    comment.text = payload.text.strip()
    await db.commit()
    return await comment_public(db, comment, user)




@router.delete("/api/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    post = await db.get(Post, comment.post_id)
    allowed = comment.author_id == user.id or user.role in {"global_admin", "admin"}
    if not allowed and post and post.community_id:
        await require_community_manager(db, post.community_id, user)
        allowed = True
    if not allowed:
        raise HTTPException(status_code=403, detail="Cannot delete this comment")
    comment.is_deleted = True
    if post:
        post.comments_count = max(0, post.comments_count - 1)
    await db.commit()
    return {"success": True}

