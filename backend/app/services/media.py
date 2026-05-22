from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import boto3
from fastapi import HTTPException, UploadFile

from app.core.config import settings

MAGIC_BYTES: dict[str, bytes] = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/webp": b"RIFF",
    "image/gif": b"GIF87a",
    "video/mp4": b"ftyp",
}

SAFE_EXTENSIONS: set[str] = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4"}


def _check_magic_bytes(content: bytes, content_type: str) -> bool:
    magic = MAGIC_BYTES.get(content_type)
    if not magic:
        return False
    if content_type == "image/webp":
        return content[8:12] == b"WEBP" if len(content) >= 12 else False
    if content_type == "video/mp4":
        return b"ftyp" in content[4:12] if len(content) >= 12 else False
    return content[: len(magic)] == magic


def _extension(filename: str, content_type: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix in SAFE_EXTENSIONS:
        return suffix
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "video/mp4": ".mp4",
    }.get(content_type, "")


async def save_upload(file: UploadFile, user_id: str) -> tuple[str, int, str]:
    if file.content_type not in settings.allowed_media_type_set:
        raise HTTPException(status_code=415, detail="Unsupported media type")
    content = await file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File is larger than {settings.max_upload_mb} MB")

    if not _check_magic_bytes(content, file.content_type or ""):
        raise HTTPException(status_code=415, detail="File content does not match declared type")

    ext = _extension(file.filename or "", file.content_type or "")
    key = f"{user_id}/{uuid4().hex}{ext}"

    if settings.s3_enabled:
        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )
        client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content,
            ContentType=file.content_type,
        )
        base = settings.s3_public_url.rstrip("/") if settings.s3_public_url else ""
        return f"{base}/{key}" if base else key, len(content), file.content_type or "application/octet-stream"

    upload_root = Path(settings.upload_dir)
    path = upload_root / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    public_path = f"/media/{key}"
    return public_path, len(content), file.content_type or "application/octet-stream"


def ensure_upload_dir() -> None:
    os.makedirs(settings.upload_dir, exist_ok=True)

