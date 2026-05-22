from __future__ import annotations

from pydantic import BaseModel


class ChatPayload(BaseModel):
    user_id: str | None = None
    username: str | None = None
    title: str | None = None
    member_ids: list[str] = []


class MessagePayload(BaseModel):
    text: str = ""
    media_url: str | None = None
    shared_post_id: str | None = None
    reply_to_message_id: str | None = None


class UpdateMessagePayload(BaseModel):
    text: str


class ChatMemberSettingsPayload(BaseModel):
    is_pinned: bool | None = None
    is_archived: bool | None = None
    muted_until: str | None = None
