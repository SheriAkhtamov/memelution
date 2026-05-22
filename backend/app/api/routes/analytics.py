from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field


AnalyticsName = Literal[
    "feed_viewed",
    "meme_viewed",
    "meme_liked",
    "meme_commented",
    "meme_shared",
    "meme_saved",
    "meme_created",
    "user_followed",
    "community_joined",
    "notification_clicked",
    "search_used",
    "onboarding_completed",
]


class AnalyticsMeta(BaseModel):
    heart: str
    pirate: str
    kano: str


class AnalyticsEventIn(BaseModel):
    id: str = Field(min_length=8, max_length=80)
    name: AnalyticsName
    created_at: datetime
    properties: dict[str, Any] = Field(default_factory=dict)
    meta: AnalyticsMeta


router = APIRouter()
_events: deque[dict[str, Any]] = deque(maxlen=1000)


@router.post("/api/analytics/events", status_code=status.HTTP_202_ACCEPTED)
async def collect_event(event: AnalyticsEventIn, request: Request) -> dict[str, bool]:
    payload = event.model_dump(mode="json")
    payload["received_at"] = datetime.now(timezone.utc).isoformat()
    payload["user_agent"] = request.headers.get("user-agent", "")[:180]
    _events.append(payload)
    return {"success": True}
