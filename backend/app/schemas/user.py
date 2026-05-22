from __future__ import annotations

from typing import Any

from pydantic import BaseModel, field_validator


PROFILE_VISIBILITY = {"public", "followers", "private"}
MESSAGE_PRIVACY = {"everyone", "following", "none"}


def normalize_privacy(value: dict[str, Any] | None) -> dict[str, Any] | None:
    if value is None:
        return None
    allowed_keys = {"profile_visibility", "post_visibility", "messages_from", "show_likes"}
    privacy = {key: item for key, item in value.items() if key in allowed_keys}
    for key in ("profile_visibility", "post_visibility"):
        if key in privacy and privacy[key] not in PROFILE_VISIBILITY:
            raise ValueError(f"Invalid {key}")
    if "messages_from" in privacy and privacy["messages_from"] not in MESSAGE_PRIVACY:
        raise ValueError("Invalid messages_from")
    if "show_likes" in privacy:
        privacy["show_likes"] = bool(privacy["show_likes"])
    return privacy


class UpdateProfilePayload(BaseModel):
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    cover_url: str | None = None
    bio: str | None = None
    website: str | None = None
    language: str | None = None
    interests: list[str] | None = None
    location: str | None = None
    privacy: dict[str, Any] | None = None
    notification_settings: dict[str, Any] | None = None
    onboarding_completed: bool | None = None

    @field_validator("privacy")
    @classmethod
    def validate_privacy(cls, value: dict[str, Any] | None) -> dict[str, Any] | None:
        return normalize_privacy(value)


class UserAchievement(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    unlocked: bool


class UserAchievementSummary(BaseModel):
    achievement_level: int
    activity_score: int
    meme_rating: int
    achievements: list[UserAchievement]
