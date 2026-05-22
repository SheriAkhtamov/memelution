from __future__ import annotations

from fastapi import Form
from pydantic import BaseModel


class RepostPayload(BaseModel):
    comment: str | None = None
    community_id: str | None = None


class PollVotePayload(BaseModel):
    option_id: str


class PostUpdatePayload(BaseModel):
    text: str = ""
    comments_enabled: bool = True

    @classmethod
    def as_form(
        cls,
        text: str = Form(""),
        comments_enabled: bool = Form(True),
    ) -> "PostUpdatePayload":
        return cls(text=text, comments_enabled=comments_enabled)


class PostReportPayload(BaseModel):
    reason: str
    description: str | None = None


class PinPostPayload(BaseModel):
    pinned: bool = True
    scope: str = "profile"
