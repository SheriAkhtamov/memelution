from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CommunityPayload(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    avatar_url: str | None = None
    cover_url: str | None = None
    category_id: str | None = None
    type: str | None = None
    language: str | None = None
    rules: str | None = None
    settings: dict[str, Any] | None = Field(default_factory=dict)


class CommunityRolePayload(BaseModel):
    role: str


class CommunityInvitePayload(BaseModel):
    username: str | None = None
    user_id: str | None = None
