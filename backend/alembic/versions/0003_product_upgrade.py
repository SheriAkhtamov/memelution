"""Product upgrade fields.

Revision ID: 0003_product_upgrade
Revises: 0002_remove_meme_evolution
Create Date: 2026-05-11
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_product_upgrade"
down_revision = "0002_remove_meme_evolution"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def _add_column_once(table: str, column: sa.Column) -> None:
    if table in _tables() and column.name not in _columns(table):
        op.add_column(table, column)


def upgrade() -> None:
    tables = _tables()
    if "community_invites" not in tables:
        op.create_table(
            "community_invites",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("community_id", sa.String(length=36), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("inviter_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("community_id", "user_id", name="uq_community_invite"),
        )
        op.create_index("ix_community_invites_community_id", "community_invites", ["community_id"])
        op.create_index("ix_community_invites_user_id", "community_invites", ["user_id"])
        op.create_index("ix_community_invites_status", "community_invites", ["status"])
        op.create_index("ix_community_invites_created_at", "community_invites", ["created_at"])

    _add_column_once("posts", sa.Column("media_items", sa.JSON(), nullable=False, server_default="[]"))
    _add_column_once("posts", sa.Column("status", sa.String(length=24), nullable=False, server_default="published"))
    _add_column_once("save_collections", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    _add_column_once("collection_posts", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))
    _add_column_once("chat_members", sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add_column_once("chat_members", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add_column_once("chat_members", sa.Column("muted_until", sa.DateTime(timezone=True), nullable=True))
    _add_column_once("messages", sa.Column("reply_to_message_id", sa.String(length=36), nullable=True))
    _add_column_once("messages", sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add_column_once("messages", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))

    existing_indexes = {index["name"] for table in _tables() for index in sa.inspect(op.get_bind()).get_indexes(table)}
    if "ix_posts_feed_cursor" not in existing_indexes:
        op.create_index("ix_posts_feed_cursor", "posts", ["is_deleted", "status", "created_at", "id"])
    if "ix_comments_cursor" not in existing_indexes:
        op.create_index("ix_comments_cursor", "comments", ["post_id", "created_at", "id"])
    if "ix_messages_cursor" not in existing_indexes:
        op.create_index("ix_messages_cursor", "messages", ["chat_id", "created_at", "id"])


def downgrade() -> None:
    for index_name, table_name in [
        ("ix_messages_cursor", "messages"),
        ("ix_comments_cursor", "comments"),
        ("ix_posts_feed_cursor", "posts"),
    ]:
        try:
            op.drop_index(index_name, table_name=table_name)
        except Exception:
            pass
    for table, columns in {
        "messages": ["edited_at", "is_pinned", "reply_to_message_id"],
        "chat_members": ["muted_until", "is_archived", "is_pinned"],
        "collection_posts": ["sort_order"],
        "save_collections": ["sort_order"],
        "posts": ["status", "media_items"],
    }.items():
        if table in _tables():
            existing = _columns(table)
            with op.batch_alter_table(table) as batch:
                for column in columns:
                    if column in existing:
                        batch.drop_column(column)
    if "community_invites" in _tables():
        op.drop_table("community_invites")
