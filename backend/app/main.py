from __future__ import annotations

import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.db.session import init_db
from app.seed import seed_database
from app.services.api_support import api_error_response
from app.services.media import ensure_upload_dir
from app.services.realtime import manager


app = FastAPI(title="Memolution API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ensure_upload_dir()
app.mount("/media", StaticFiles(directory=settings.upload_dir), name="media")
app.include_router(api_router)

_rate_buckets: dict[str, list[float]] = {}


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    message = str(exc.detail) if exc.detail else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=api_error_response(message, exc.status_code),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=api_error_response(
            "Проверьте поля формы",
            422,
            code="VALIDATION_ERROR",
            details={"errors": exc.errors()},
        ),
    )


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path.startswith("/media"):
        return await call_next(request)
    forwarded = request.headers.get("x-forwarded-for", "")
    real_ip = forwarded.split(",")[0].strip() if forwarded else ""
    key = real_ip or (request.client.host if request.client else "unknown")
    current = time.monotonic()
    window_start = current - settings.rate_limit_window_seconds
    bucket = [stamp for stamp in _rate_buckets.get(key, []) if stamp >= window_start]
    if len(bucket) >= settings.rate_limit_max_requests:
        return JSONResponse(
            api_error_response("Too many requests", 429, code="TOO_MANY_REQUESTS"),
            status_code=429,
        )
    bucket.append(current)
    _rate_buckets[key] = bucket
    return await call_next(request)


@app.on_event("startup")
async def startup() -> None:
    await init_db()
    await manager.start()
    if settings.dev_seed_on_startup:
        await seed_database()


@app.on_event("shutdown")
async def shutdown() -> None:
    await manager.stop()
