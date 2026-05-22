"""Pydantic schemas for API request and response contracts."""

from app.schemas.auth import AdminLoginPayload, AuthPayload
from app.schemas.chat import ChatMemberSettingsPayload, ChatPayload, MessagePayload, UpdateMessagePayload
from app.schemas.comment import CommentPayload, UpdateCommentPayload
from app.schemas.community import CommunityInvitePayload, CommunityPayload, CommunityRolePayload
from app.schemas.notification import NotificationSettingsPayload
from app.schemas.post import PinPostPayload, PollVotePayload, PostReportPayload, PostUpdatePayload, RepostPayload
from app.schemas.report import AdminModerationPayload, AdminRolePayload, ReportPayload, ResolveReportPayload
from app.schemas.saved import (
    MoveSavedPostPayload,
    SaveCollectionPayload,
    SaveToCollectionPayload,
    UpdateSaveCollectionPayload,
)
from app.schemas.system import HealthResponse
from app.schemas.user import UpdateProfilePayload

__all__ = [
    "AdminLoginPayload",
    "AdminModerationPayload",
    "AdminRolePayload",
    "AuthPayload",
    "ChatMemberSettingsPayload",
    "ChatPayload",
    "CommentPayload",
    "CommunityInvitePayload",
    "CommunityPayload",
    "CommunityRolePayload",
    "HealthResponse",
    "MessagePayload",
    "MoveSavedPostPayload",
    "NotificationSettingsPayload",
    "PinPostPayload",
    "PollVotePayload",
    "PostReportPayload",
    "PostUpdatePayload",
    "ReportPayload",
    "RepostPayload",
    "ResolveReportPayload",
    "SaveCollectionPayload",
    "SaveToCollectionPayload",
    "UpdateCommentPayload",
    "UpdateMessagePayload",
    "UpdateProfilePayload",
    "UpdateSaveCollectionPayload",
]
