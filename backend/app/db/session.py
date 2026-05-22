from collections.abc import AsyncGenerator

from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models import Base


engine = create_async_engine(settings.database_url, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(ensure_schema_columns)


def ensure_schema_columns(sync_conn) -> None:
    inspector = inspect(sync_conn)
    if not inspector.has_table("users"):
        return
    dialect = sync_conn.dialect.name
    user_existing = {column["name"] for column in inspector.get_columns("users")}
    user_columns = {
        "banned_until": "TIMESTAMP NULL",
        "ban_reason": "TEXT NULL",
        "restrictions": "JSON NOT NULL DEFAULT '{}'" if dialect != "postgresql" else "JSONB NOT NULL DEFAULT '{}'::jsonb",
    }
    for name, definition in user_columns.items():
        if name not in user_existing:
            sync_conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {name} {definition}")

    if inspector.has_table("save_collections"):
        save_collection_existing = {column["name"] for column in inspector.get_columns("save_collections")}
        save_collection_columns = {
            "description": "TEXT NOT NULL DEFAULT ''",
            "visibility": "VARCHAR(24) NOT NULL DEFAULT 'private'",
            "sort_order": "INTEGER NOT NULL DEFAULT 0",
        }
        for name, definition in save_collection_columns.items():
            if name not in save_collection_existing:
                sync_conn.exec_driver_sql(f"ALTER TABLE save_collections ADD COLUMN {name} {definition}")

    json_type = "JSONB" if dialect == "postgresql" else "JSON"
    if inspector.has_table("posts"):
        existing = {column["name"] for column in inspector.get_columns("posts")}
        post_columns = {
            "media_items": f"{json_type} NOT NULL DEFAULT '[]'" if dialect != "postgresql" else "JSONB NOT NULL DEFAULT '[]'::jsonb",
            "status": "VARCHAR(24) NOT NULL DEFAULT 'published'",
        }
        for name, definition in post_columns.items():
            if name not in existing:
                sync_conn.exec_driver_sql(f"ALTER TABLE posts ADD COLUMN {name} {definition}")

    if inspector.has_table("collection_posts"):
        existing = {column["name"] for column in inspector.get_columns("collection_posts")}
        if "sort_order" not in existing:
            sync_conn.exec_driver_sql("ALTER TABLE collection_posts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")

    if inspector.has_table("chat_members"):
        existing = {column["name"] for column in inspector.get_columns("chat_members")}
        columns = {
            "is_pinned": "BOOLEAN NOT NULL DEFAULT FALSE",
            "is_archived": "BOOLEAN NOT NULL DEFAULT FALSE",
            "muted_until": "TIMESTAMP NULL",
        }
        for name, definition in columns.items():
            if name not in existing:
                sync_conn.exec_driver_sql(f"ALTER TABLE chat_members ADD COLUMN {name} {definition}")

    if inspector.has_table("messages"):
        existing = {column["name"] for column in inspector.get_columns("messages")}
        columns = {
            "reply_to_message_id": "VARCHAR(36) NULL",
            "is_pinned": "BOOLEAN NOT NULL DEFAULT FALSE",
            "edited_at": "TIMESTAMP NULL",
        }
        for name, definition in columns.items():
            if name not in existing:
                sync_conn.exec_driver_sql(f"ALTER TABLE messages ADD COLUMN {name} {definition}")
