from __future__ import annotations

import asyncio
from collections import defaultdict
from contextlib import suppress
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from app.core.config import settings


class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[str, set[WebSocket]] = defaultdict(set)
        self.redis: Redis | None = None
        self.listener_task: asyncio.Task | None = None
        self.channel = "memolution:realtime"

    async def start(self) -> None:
        if not settings.enable_redis or self.redis:
            return
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.listener_task = asyncio.create_task(self._listen())

    async def ensure_redis(self) -> None:
        if not settings.enable_redis:
            return
        if not self.redis:
            self.redis = Redis.from_url(settings.redis_url, decode_responses=True)

    async def stop(self) -> None:
        if self.listener_task:
            self.listener_task.cancel()
            with suppress(asyncio.CancelledError):
                await self.listener_task
        if self.redis:
            await self.redis.aclose()
        self.listener_task = None
        self.redis = None

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active[user_id].add(websocket)
        await self.send(user_id, {"event": "online", "user_id": user_id}, publish=False)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        sockets = self.active.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self.active.pop(user_id, None)

    async def send(self, user_id: str, payload: dict[str, Any], publish: bool = True) -> None:
        if publish and self.redis:
            await self.redis.publish(self.channel, __import__("json").dumps({"user_id": user_id, "payload": payload}))
            return
        await self._send_local(user_id, payload)

    async def _send_local(self, user_id: str, payload: dict[str, Any]) -> None:
        disconnected: list[WebSocket] = []
        for websocket in self.active.get(user_id, set()):
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(user_id, websocket)

    async def _listen(self) -> None:
        if not self.redis:
            return
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(self.channel)
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    data = __import__("json").loads(message["data"])
                except (TypeError, ValueError):
                    continue
                user_id = data.get("user_id")
                payload = data.get("payload")
                if isinstance(user_id, str) and isinstance(payload, dict):
                    await self._send_local(user_id, payload)
        finally:
            await pubsub.unsubscribe(self.channel)
            await pubsub.aclose()


manager = ConnectionManager()
