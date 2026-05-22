"""Remove meme evolution schema.

Revision ID: 0002_remove_meme_evolution
Revises: 0001_initial
Create Date: 2026-05-11
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_remove_meme_evolution"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return {column["name"] for column in inspector.get_columns(table_name)}


def _table_names() -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return set(inspector.get_table_names())


def _drop_indexes_for_columns(table_name: str, column_names: set[str]) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for index in inspector.get_indexes(table_name):
        if column_names.intersection(index.get("column_names") or []):
            op.drop_index(index["name"], table_name=table_name)


def upgrade() -> None:
    if "_alembic_tmp_posts" in _table_names():
        op.drop_table("_alembic_tmp_posts")

    op.execute("UPDATE posts SET type = 'meme' WHERE type = 'meme_version'")
    removed_columns = {"original_meme_id", "version_note", "meme_versions_count"}
    existing = _columns("posts")
    _drop_indexes_for_columns("posts", removed_columns)
    with op.batch_alter_table("posts") as batch:
        if "original_meme_id" in existing:
            batch.drop_column("original_meme_id")
        if "version_note" in existing:
            batch.drop_column("version_note")
        if "meme_versions_count" in existing:
            batch.drop_column("meme_versions_count")


def downgrade() -> None:
    existing = _columns("posts")
    with op.batch_alter_table("posts") as batch:
        if "original_meme_id" not in existing:
            batch.add_column(sa.Column("original_meme_id", sa.String(length=36), nullable=True))
        if "version_note" not in existing:
            batch.add_column(sa.Column("version_note", sa.Text(), nullable=True))
        if "meme_versions_count" not in existing:
            batch.add_column(sa.Column("meme_versions_count", sa.Integer(), nullable=False, server_default="0"))
        batch.create_index("ix_posts_original_meme_id", ["original_meme_id"])
