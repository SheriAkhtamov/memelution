from __future__ import annotations


from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    decode_token,
    get_current_user,
)
from app.db.session import get_session
from app.models import (
    Notification, User,
)
from app.schemas import (
    NotificationSettingsPayload,
)
from app.services.api_support import *  # noqa: F403
from app.services.realtime import manager

router = APIRouter()

@router.get("/api/notifications")
async def notifications(
    type: str | None = None,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    query = select(Notification).where(Notification.user_id == user.id)
    if type:
        query = query.where(Notification.type == type)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    rows = (
        await db.scalars(
            query.order_by(desc(Notification.created_at)).limit(100)
        )
    ).all()
    return [
        {
            "id": item.id,
            "type": item.type,
            "data": item.data,
            "is_read": item.is_read,
            "created_at": item.created_at.isoformat(),
        }
        for item in rows
    ]




@router.post("/api/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    return {"success": True}




@router.post("/api/notifications/read-all")
async def mark_all_notifications_read(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    rows = (await db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)))).all()
    for row in rows:
        row.is_read = True
    await db.commit()
    return {"success": True, "updated": len(rows)}


@router.get("/api/notifications/settings")
async def notification_settings(user: User = Depends(get_current_user)):
    return user.notification_settings or {}


@router.patch("/api/notifications/settings")
async def update_notification_settings(
    payload: NotificationSettingsPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    user.notification_settings = payload.settings
    await db.commit()
    return user.notification_settings




@router.websocket("/api/ws/notifications")
async def notifications_socket(websocket: WebSocket, token: str):
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=1008)
        return
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)

