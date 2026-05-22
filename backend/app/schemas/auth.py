from __future__ import annotations

from pydantic import BaseModel


class AuthPayload(BaseModel):
    telegram_id: str | None = None
    id: str | int | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    photo_url: str | None = None
    hash: str | None = None
    dev: bool = False


class AdminLoginPayload(BaseModel):
    login: str
    password: str
