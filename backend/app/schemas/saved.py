from __future__ import annotations

from pydantic import BaseModel


class SaveCollectionPayload(BaseModel):
    name: str
    description: str = ""
    visibility: str = "private"


class SaveToCollectionPayload(BaseModel):
    collection_id: str | None = None


class UpdateSaveCollectionPayload(BaseModel):
    name: str | None = None
    description: str | None = None
    visibility: str | None = None
    sort_order: int | None = None


class MoveSavedPostPayload(BaseModel):
    collection_id: str
