from __future__ import annotations

from sqlalchemy.sql.elements import ColumnElement

from app.models import Post


def engagement_score() -> ColumnElement[int]:
    return Post.likes_count + Post.comments_count * 2 + Post.reposts_count * 3 + Post.saves_count * 3


def normalize_interest_tags(interests: list[str] | None) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in interests or []:
        tag = str(item).strip().lower().removeprefix("#")
        if tag and tag not in seen:
            seen.add(tag)
            result.append(tag)
    return result
