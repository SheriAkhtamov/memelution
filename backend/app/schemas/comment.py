from __future__ import annotations

from pydantic import BaseModel


class CommentPayload(BaseModel):
    text: str
    parent_comment_id: str | None = None


class UpdateCommentPayload(BaseModel):
    text: str
