from __future__ import annotations

from fastapi import APIRouter

from app.schemas import HealthResponse
from app.services.api_support import health_status

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(**health_status())

