from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    decode_token,
    get_current_user,
)
from app.db.session import SessionLocal, get_session
from app.models import (
    Chat, ChatMember, Message, MessageReaction, MessageRead, Post, User, now,
)
from app.schemas import (
    ChatMemberSettingsPayload,
    ChatPayload, MessagePayload,
    UpdateMessagePayload,
)
from app.services.api_support import *  # noqa: F403
from app.services.realtime import manager

router = APIRouter()
ALLOWED_MESSAGE_REACTIONS = {"😂", "❤️", "🔥", "😢", "😡", "👏", "💀", "🤡", "👍"}


async def _message_reactions_map(
    db: AsyncSession,
    message_ids: list[str],
    viewer: User | None,
) -> dict[str, list[dict]]:
    if not message_ids:
        return {}
    rows = (
        await db.execute(
            select(MessageReaction.message_id, MessageReaction.emoji, func.count(MessageReaction.id).label("cnt"))
            .where(MessageReaction.message_id.in_(message_ids))
            .group_by(MessageReaction.message_id, MessageReaction.emoji)
        )
    ).all()
    reactions_map: dict[str, list[dict]] = {}
    for row in rows:
        reactions_map.setdefault(row.message_id, []).append(
            {"emoji": row.emoji, "count": row.cnt, "reacted": False}
        )
    if viewer:
        viewer_reactions = (
            await db.scalars(
                select(MessageReaction).where(
                    MessageReaction.user_id == viewer.id,
                    MessageReaction.message_id.in_(message_ids),
                )
            )
        ).all()
        viewer_reaction_set = {(reaction.message_id, reaction.emoji) for reaction in viewer_reactions}
        for message_id, items in reactions_map.items():
            for item in items:
                if (message_id, item["emoji"]) in viewer_reaction_set:
                    item["reacted"] = True
    return reactions_map


async def _message_reactions_summary(db: AsyncSession, message_id: str, viewer: User | None) -> list[dict]:
    return (await _message_reactions_map(db, [message_id], viewer)).get(message_id, [])


async def _broadcast_message_reaction(db: AsyncSession, chat_id: str, message_id: str, reactions: list[dict]) -> None:
    recipients = (await db.scalars(select(ChatMember).where(ChatMember.chat_id == chat_id))).all()
    payload = {
        "event": "message_reaction",
        "chat_id": chat_id,
        "message_id": message_id,
        "reactions": reactions,
    }
    for recipient in recipients:
        await manager.send(recipient.user_id, payload)

@router.get("/api/chats")
async def list_chats(db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    memberships = (await db.scalars(select(ChatMember).where(ChatMember.user_id == user.id))).all()
    result = []
    for member in memberships:
        chat = await db.get(Chat, member.chat_id)
        latest = await db.scalar(
            select(Message).where(Message.chat_id == member.chat_id).order_by(desc(Message.created_at)).limit(1)
        )
        unread = await db.scalar(
            select(func.count(Message.id)).where(
                Message.chat_id == member.chat_id,
                Message.sender_id != user.id,
                Message.is_deleted.is_(False),
                Message.id.not_in(select(MessageRead.message_id).where(MessageRead.user_id == user.id)),
            )
        )
        members = (await db.scalars(select(ChatMember).where(ChatMember.chat_id == member.chat_id))).all()
        users = [await db.get(User, item.user_id) for item in members if item.user_id != user.id]
        result.append(
            {
                "id": chat.id,
                "type": chat.type,
                "title": chat.title or ", ".join(item.display_name for item in users if item),
                "avatar_url": absolutize(chat.avatar_url) or (user_public(users[0]) or {}).get("avatar_url") if users else None,
                "members": [user_public(item) for item in users if item],
                "latest_message": {
                    "id": latest.id,
                    "text": latest.text,
                    "created_at": latest.created_at.isoformat(),
                }
                if latest
                else None,
                "unread_count": unread or 0,
            }
        )
    return result




@router.post("/api/chats")
async def create_chat(payload: ChatPayload, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    member_ids = set(payload.member_ids)
    if payload.username:
        target = await db.scalar(select(User).where(User.username == payload.username.lstrip("@").lower()))
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        member_ids.add(target.id)
    if payload.user_id:
        member_ids.add(payload.user_id)
    member_ids.discard(user.id)
    if not member_ids:
        raise HTTPException(status_code=422, detail="At least one recipient is required")
    chat_type = "group" if len(member_ids) > 1 else "direct"

    # For direct chats, check if one already exists between these two users
    if chat_type == "direct":
        other_id = next(iter(member_ids))
        existing_chat_id = await db.scalar(
            select(ChatMember.chat_id).where(
                ChatMember.user_id == user.id,
                ChatMember.chat_id.in_(
                    select(ChatMember.chat_id).where(ChatMember.user_id == other_id)
                ),
                ChatMember.chat_id.in_(
                    select(Chat.id).where(Chat.type == "direct")
                ),
            )
        )
        if existing_chat_id:
            existing_chat = await db.get(Chat, existing_chat_id)
            return {"id": existing_chat.id, "type": existing_chat.type, "title": existing_chat.title}

    chat = Chat(type=chat_type, title=payload.title)
    db.add(chat)
    await db.flush()
    db.add(ChatMember(chat_id=chat.id, user_id=user.id, role="admin" if chat_type == "group" else "member"))
    for member_id in member_ids:
        db.add(ChatMember(chat_id=chat.id, user_id=member_id, role="member"))
    await db.commit()
    return {"id": chat.id, "type": chat.type, "title": chat.title}




@router.get("/api/chats/{chat_id}/messages")
async def chat_messages(
    chat_id: str,
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = None,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")
    query = select(Message).where(Message.chat_id == chat_id).order_by(desc(Message.created_at), desc(Message.id))
    query = apply_desc_cursor(query, Message, cursor)
    rows = (
        await db.scalars(query.limit(limit + 1))
    ).all()
    page_rows = list(reversed(rows[:limit]))
    sender_ids = {item.sender_id for item in page_rows}
    senders = {
        item.id: item
        for item in (await db.scalars(select(User).where(User.id.in_(sender_ids)))).all()
    } if sender_ids else {}
    read_rows = (
        await db.execute(
            select(MessageRead.message_id, func.count(MessageRead.id))
            .where(MessageRead.message_id.in_([item.id for item in page_rows]))
            .group_by(MessageRead.message_id)
        )
    ).all() if page_rows else []
    read_counts = {message_id: count for message_id, count in read_rows}
    reactions_map = await _message_reactions_map(db, [item.id for item in page_rows], user)
    shared_posts = {}
    shared_post_ids = {item.shared_post_id for item in page_rows if item.shared_post_id}
    if shared_post_ids:
        shared_posts = {
            post.id: post
            for post in (await db.scalars(select(Post).where(Post.id.in_(shared_post_ids), Post.is_deleted.is_(False)))).all()
        }
        shared_posts = {post_id: await post_public(db, post, user) for post_id, post in shared_posts.items()}
    items = []
    for item in page_rows:
        items.append(
            {
            "id": item.id,
            "chat_id": item.chat_id,
            "sender": user_public(senders.get(item.sender_id)),
            "text": "" if item.is_deleted else item.text,
            "media_url": absolutize(item.media_url),
            "shared_post_id": item.shared_post_id,
            "shared_post": shared_posts.get(item.shared_post_id),
            "reply_to_message_id": item.reply_to_message_id,
            "is_pinned": item.is_pinned,
            "is_deleted": item.is_deleted,
            "read_count": read_counts.get(item.id, 0),
            "reactions": reactions_map.get(item.id, []),
            "created_at": item.created_at.isoformat(),
            "edited_at": item.edited_at.isoformat() if item.edited_at else None,
        }
        )
    next_payload = None
    if rows[:limit] and len(rows) > limit:
        last = rows[:limit][-1]
        next_payload = {"created_at": last.created_at, "id": last.id}
    return {
        "items": items,
        "next_cursor": encode_cursor(next_payload),
        "has_more": len(rows) > limit,
    }




@router.post("/api/chats/{chat_id}/messages")
async def send_message(
    chat_id: str,
    payload: MessagePayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    ensure_not_restricted(user, "messages")
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")
    if not payload.text.strip() and not payload.media_url and not payload.shared_post_id:
        raise HTTPException(status_code=422, detail="Message text or attachment is required")
    message = Message(
        chat_id=chat_id,
        sender_id=user.id,
        text=payload.text.strip(),
        media_url=payload.media_url,
        shared_post_id=payload.shared_post_id,
        reply_to_message_id=payload.reply_to_message_id,
    )
    db.add(message)
    recipients = (await db.scalars(select(ChatMember).where(ChatMember.chat_id == chat_id))).all()
    for recipient in recipients:
        if recipient.user_id != user.id:
            await notify(db, recipient.user_id, "message", {"chat_id": chat_id, "actor": user.display_name})
    await db.commit()
    await db.refresh(message)
    payload = {
        "id": message.id,
        "chat_id": chat_id,
        "sender": user_public(user),
        "text": message.text,
        "media_url": absolutize(message.media_url),
        "shared_post_id": message.shared_post_id,
        "reply_to_message_id": message.reply_to_message_id,
        "is_pinned": message.is_pinned,
        "is_deleted": message.is_deleted,
        "reactions": [],
        "created_at": message.created_at.isoformat(),
        "edited_at": None,
    }
    for recipient in recipients:
        if recipient.user_id != user.id:
            await manager.send(recipient.user_id, {"event": "chat_message", "chat_id": chat_id, "message": payload})
    return payload




@router.post("/api/chats/{chat_id}/read")
async def read_chat(chat_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")
    messages = (
        await db.scalars(
            select(Message).where(
                Message.chat_id == chat_id,
                Message.sender_id != user.id,
                Message.id.not_in(select(MessageRead.message_id).where(MessageRead.user_id == user.id)),
            )
        )
    ).all()
    for message in messages:
        db.add(MessageRead(message_id=message.id, chat_id=chat_id, user_id=user.id))
    await db.commit()
    members = (await db.scalars(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id != user.id))).all()
    for member in members:
        await manager.send(member.user_id, {"event": "read_receipt", "chat_id": chat_id, "user_id": user.id})
    return {"success": True, "updated": len(messages)}


@router.patch("/api/messages/{message_id}")
async def update_message(
    message_id: str,
    payload: UpdateMessagePayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    message = await db.get(Message, message_id)
    if not message or message.is_deleted:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.sender_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot edit this message")
    if not payload.text.strip():
        raise HTTPException(status_code=422, detail="Message text is required")
    message.text = payload.text.strip()
    message.edited_at = now()
    recipients = (await db.scalars(select(ChatMember).where(ChatMember.chat_id == message.chat_id))).all()
    await db.commit()
    body = {
        "event": "message_edited",
        "chat_id": message.chat_id,
        "message_id": message.id,
        "text": message.text,
        "edited_at": message.edited_at.isoformat() if message.edited_at else None,
    }
    for recipient in recipients:
        await manager.send(recipient.user_id, body)
    return {"success": True, **body}


@router.post("/api/chats/{chat_id}/settings")
async def update_chat_settings(
    chat_id: str,
    payload: ChatMemberSettingsPayload,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")
    data = payload.model_dump(exclude_unset=True)
    for field in ["is_pinned", "is_archived"]:
        if field in data:
            setattr(member, field, bool(data[field]))
    if "muted_until" in data:
        member.muted_until = parse_cursor_datetime(data["muted_until"]) if data["muted_until"] else None
    await db.commit()
    return {"success": True}




@router.delete("/api/messages/{message_id}")
async def delete_message(
    message_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.sender_id != user.id:
        raise HTTPException(status_code=403, detail="Cannot delete this message")
    message.is_deleted = True
    recipients = (await db.scalars(select(ChatMember).where(ChatMember.chat_id == message.chat_id))).all()
    await db.commit()
    for recipient in recipients:
        await manager.send(recipient.user_id, {"event": "message_deleted", "chat_id": message.chat_id, "message_id": message.id})
    return {"success": True}


@router.post("/api/messages/{message_id}/reactions")
async def add_message_reaction(
    message_id: str,
    emoji: str = Query(..., max_length=8),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    if emoji not in ALLOWED_MESSAGE_REACTIONS:
        raise HTTPException(status_code=422, detail="Unsupported reaction emoji")
    message = await db.get(Message, message_id)
    if not message or message.is_deleted:
        raise HTTPException(status_code=404, detail="Message not found")
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == message.chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")
    existing = await db.scalar(
        select(MessageReaction).where(
            MessageReaction.user_id == user.id,
            MessageReaction.message_id == message_id,
            MessageReaction.emoji == emoji,
        )
    )
    if not existing:
        db.add(MessageReaction(user_id=user.id, message_id=message_id, emoji=emoji))
    await db.commit()
    reactions = await _message_reactions_summary(db, message_id, user)
    await _broadcast_message_reaction(db, message.chat_id, message_id, reactions)
    return {"success": True, "reactions": reactions}


@router.delete("/api/messages/{message_id}/reactions")
async def remove_message_reaction(
    message_id: str,
    emoji: str = Query(..., max_length=8),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == message.chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")
    existing = await db.scalar(
        select(MessageReaction).where(
            MessageReaction.user_id == user.id,
            MessageReaction.message_id == message_id,
            MessageReaction.emoji == emoji,
        )
    )
    if existing:
        await db.delete(existing)
        await db.commit()
    reactions = await _message_reactions_summary(db, message_id, user)
    await _broadcast_message_reaction(db, message.chat_id, message_id, reactions)
    return {"success": True, "reactions": reactions}




@router.get("/api/chats/{chat_id}")
async def chat_detail(chat_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")
    chat = await db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    members = (await db.scalars(select(ChatMember).where(ChatMember.chat_id == chat_id))).all()
    member_ids = [item.user_id for item in members]
    users = {
        item.id: item
        for item in (await db.scalars(select(User).where(User.id.in_(member_ids)))).all()
    }

    media = (
        await db.scalars(
            select(Message)
            .where(Message.chat_id == chat_id, Message.media_url.is_not(None), Message.is_deleted.is_(False))
            .order_by(desc(Message.created_at))
            .limit(50)
        )
    ).all()
    shared_media = [
        {
            "id": item.id,
            "url": absolutize(item.media_url),
            "created_at": item.created_at.isoformat(),
            "sender": user_public(users.get(item.sender_id)),
        }
        for item in media
    ]

    return {
        "id": chat.id,
        "type": chat.type,
        "title": chat.title,
        "avatar_url": absolutize(chat.avatar_url),
        "members": [user_public(users.get(item.user_id)) for item in members if users.get(item.user_id)],
        "member_roles": [{"user_id": item.user_id, "role": item.role, "is_pinned": item.is_pinned, "is_archived": item.is_archived, "muted_until": item.muted_until.isoformat() if item.muted_until else None} for item in members],
        "shared_media": shared_media,
        "members_count": len(members),
    }


@router.delete("/api/chats/{chat_id}")
async def leave_chat(chat_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")
    chat = await db.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    await db.delete(member)
    remaining = (
        await db.scalars(select(ChatMember).where(ChatMember.chat_id == chat_id))
    ).all()

    if chat.type == "direct" or not remaining:
        msgs = (
            await db.scalars(select(Message).where(Message.chat_id == chat_id))
        ).all()
        for msg in msgs:
            await db.delete(msg)
        for other in remaining:
            await db.delete(other)
        await db.delete(chat)
        await db.commit()
        for other in remaining:
            await manager.send(other.user_id, {"event": "chat_deleted", "chat_id": chat_id})
        return {"success": True, "deleted": True}

    await db.commit()
    for other in remaining:
        await manager.send(other.user_id, {"event": "chat_member_left", "chat_id": chat_id, "user_id": user.id, "display_name": user.display_name})
    return {"success": True, "deleted": False}


@router.post("/api/messages/{message_id}/forward")
async def forward_message(
    message_id: str,
    chat_id: str = Query(...),
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    source = await db.get(Message, message_id)
    if not source:
        raise HTTPException(status_code=404, detail="Message not found")
    member = await db.scalar(select(ChatMember).where(ChatMember.chat_id == chat_id, ChatMember.user_id == user.id))
    if not member:
        raise HTTPException(status_code=403, detail="Not a chat member")

    forward_text = source.text
    if source.is_deleted:
        forward_text = "Сообщение удалено"
    if source.sender_id != user.id:
        sender = await db.get(User, source.sender_id)
        if sender:
            forward_text = f"↪ Переслано от @{sender.username}\n{forward_text}"

    message = Message(
        chat_id=chat_id,
        sender_id=user.id,
        text=forward_text,
        media_url=source.media_url,
        shared_post_id=source.shared_post_id,
    )
    db.add(message)
    recipients = (await db.scalars(select(ChatMember).where(ChatMember.chat_id == chat_id))).all()
    for recipient in recipients:
        if recipient.user_id != user.id:
            await notify(db, recipient.user_id, "message", {"chat_id": chat_id, "actor": user.display_name})
    await db.commit()
    await db.refresh(message)
    payload = {
        "id": message.id,
        "chat_id": chat_id,
        "sender": user_public(user),
        "text": message.text,
        "media_url": absolutize(message.media_url),
        "shared_post_id": message.shared_post_id,
        "reply_to_message_id": message.reply_to_message_id,
        "reactions": [],
        "is_deleted": message.is_deleted,
        "created_at": message.created_at.isoformat(),
        "edited_at": None,
    }
    for recipient in recipients:
        if recipient.user_id != user.id:
            await manager.send(recipient.user_id, {"event": "chat_message", "chat_id": chat_id, "message": payload})
    return payload


@router.websocket("/api/ws/chats")
async def chats_socket(websocket: WebSocket, token: str):
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=1008)
        return
    await manager.connect(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if event.get("event") != "typing" or not event.get("chat_id"):
                continue
            async with SessionLocal() as db:
                members = (
                    await db.scalars(
                        select(ChatMember).where(
                            ChatMember.chat_id == event["chat_id"],
                            ChatMember.user_id != user_id,
                        )
                    )
                ).all()
                sender = await db.get(User, user_id)
                for member in members:
                    await manager.send(
                        member.user_id,
                        {
                            "event": "typing",
                            "chat_id": event["chat_id"],
                            "user": user_public(sender),
                        },
                    )
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
