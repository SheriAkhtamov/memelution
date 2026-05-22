from __future__ import annotations


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    get_current_user,
    get_optional_user,
)
from app.db.session import get_session
from app.models import (
    CollectionPost, Post, Save, SaveCollection,
    User,
)
from app.schemas import (
    MoveSavedPostPayload, SaveCollectionPayload, UpdateSaveCollectionPayload,
)
from app.services.api_support import *  # noqa: F403

router = APIRouter()

@router.get("/api/saved")
async def saved_posts(
    q: str | None = None,
    collection_id: str | None = None,
    sort: str = "saved_desc",
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if sort not in {"saved_desc", "saved_asc", "post_newest", "popular"}:
        raise HTTPException(status_code=422, detail="Invalid saved posts sort")
    query = select(Save).where(Save.user_id == user.id)
    if collection_id:
        query = query.where(Save.collection_id == collection_id)
    save_order = asc(Save.created_at) if sort == "saved_asc" else desc(Save.created_at)
    saves = (await db.scalars(query.order_by(save_order))).all()
    posts = [await db.get(Post, item.post_id) for item in saves]
    result = [item for item in posts if item and not item.is_deleted and item.status == "published"]
    if q:
        needle = q.lower()
        result = [item for item in result if needle in (item.text or "").lower()]
    if sort == "post_newest":
        result.sort(key=lambda item: item.created_at, reverse=True)
    elif sort == "popular":
        result.sort(key=lambda item: (item.likes_count + item.comments_count + item.reposts_count + item.saves_count, item.created_at), reverse=True)
    return await posts_public(db, result, user)




@router.get("/api/save-collections")
async def list_save_collections(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    rows = (
        await db.scalars(
            select(SaveCollection)
            .where(SaveCollection.user_id == user.id)
            .order_by(SaveCollection.sort_order, SaveCollection.created_at)
        )
    ).all()
    if not rows:
        default = SaveCollection(user_id=user.id, name="Все сохранённые")
        db.add(default)
        await db.commit()
        await db.refresh(default)
        rows = [default]
    return [await collection_public(db, item, user) for item in rows]




@router.post("/api/save-collections")
async def create_save_collection(
    payload: SaveCollectionPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if payload.visibility not in {"private", "public"}:
        raise HTTPException(status_code=422, detail="Invalid collection visibility")
    collection = SaveCollection(
        user_id=user.id,
        name=payload.name.strip()[:80] or "Новая коллекция",
        description=payload.description.strip(),
        visibility=payload.visibility,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return await collection_public(db, collection, user)




@router.get("/api/save-collections/{collection_id}")
async def get_save_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_session),
    viewer: User | None = Depends(get_optional_user),
):
    collection = await db.get(SaveCollection, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.visibility != "public" and (not viewer or viewer.id != collection.user_id):
        raise HTTPException(status_code=403, detail="Collection is private")
    saves = (await db.scalars(select(Save).where(Save.collection_id == collection.id).order_by(desc(Save.created_at)))).all()
    posts = [await db.get(Post, item.post_id) for item in saves]
    return {
        "collection": await collection_public(db, collection, viewer),
        "posts": await posts_public(db, [item for item in posts if item and not item.is_deleted and item.status == "published"], viewer),
    }


@router.patch("/api/save-collections/{collection_id}")
async def update_save_collection(
    collection_id: str,
    payload: UpdateSaveCollectionPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    collection = await db.get(SaveCollection, collection_id)
    if not collection or collection.user_id != user.id:
        raise HTTPException(status_code=404, detail="Collection not found")
    data = payload.model_dump(exclude_unset=True)
    if "visibility" in data and data["visibility"] not in {"private", "public"}:
        raise HTTPException(status_code=422, detail="Invalid collection visibility")
    for field in ["name", "description", "visibility", "sort_order"]:
        if field in data and data[field] is not None:
            setattr(collection, field, data[field].strip() if isinstance(data[field], str) else data[field])
    await db.commit()
    await db.refresh(collection)
    return await collection_public(db, collection, user)


@router.delete("/api/save-collections/{collection_id}")
async def delete_save_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    collection = await db.get(SaveCollection, collection_id)
    if not collection or collection.user_id != user.id:
        raise HTTPException(status_code=404, detail="Collection not found")
    default = await db.scalar(
        select(SaveCollection).where(
            SaveCollection.user_id == user.id,
            SaveCollection.id != collection_id,
            SaveCollection.name == "Все сохранённые",
        )
    )
    if not default:
        default = SaveCollection(user_id=user.id, name="Все сохранённые")
        db.add(default)
        await db.flush()
    saves = (await db.scalars(select(Save).where(Save.collection_id == collection.id))).all()
    for save in saves:
        save.collection_id = default.id
    await db.delete(collection)
    await db.commit()
    return {"success": True, "fallback_collection_id": default.id}


@router.post("/api/save-collections/{collection_id}/posts/{post_id}/move")
async def move_saved_post(
    collection_id: str,
    post_id: str,
    payload: MoveSavedPostPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    source = await db.get(SaveCollection, collection_id)
    target = await db.get(SaveCollection, payload.collection_id)
    if not source or not target or source.user_id != user.id or target.user_id != user.id:
        raise HTTPException(status_code=404, detail="Collection not found")
    save = await db.scalar(select(Save).where(Save.user_id == user.id, Save.post_id == post_id))
    if not save:
        raise HTTPException(status_code=404, detail="Saved post not found")
    save.collection_id = target.id
    existing = await db.scalar(select(CollectionPost).where(CollectionPost.collection_id == target.id, CollectionPost.post_id == post_id))
    if not existing:
        db.add(CollectionPost(collection_id=target.id, post_id=post_id))
    old = await db.scalar(select(CollectionPost).where(CollectionPost.collection_id == source.id, CollectionPost.post_id == post_id))
    if old:
        await db.delete(old)
    await db.commit()
    return {"success": True, "collection_id": target.id}
