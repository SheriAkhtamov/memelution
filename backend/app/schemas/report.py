from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ReportPayload(BaseModel):
    target_type: Literal["post", "comment", "user", "community"]
    target_id: str
    reason: str
    description: str | None = None


class ResolveReportPayload(BaseModel):
    status: Literal["open", "pending", "resolved", "rejected"]
    action: Literal[
        "hide_post",
        "delete_post",
        "hide_comment",
        "delete_comment",
        "ban_user",
        "ban_community",
        "reject_report",
        "resolve_report",
    ] | None = None
    reason: str | None = None


class AdminRolePayload(BaseModel):
    role: str


class AdminModerationPayload(BaseModel):
    is_banned: bool | None = None
    duration_hours: int | None = None
    reason: str | None = None
    restrictions: dict[str, bool] | None = None
