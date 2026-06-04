"""add comment and message reactions

Revision ID: 20260523_01
Revises: 20260514_01
Create Date: 2026-05-23 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260523_01"
down_revision: Union[str, None] = "20260514_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "comment_reactions" not in tables:
        op.create_table(
            "comment_reactions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("comment_id", sa.String(36), sa.ForeignKey("comments.id", ondelete="CASCADE"), nullable=False),
            sa.Column("emoji", sa.String(8), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "comment_id", "emoji", name="uq_comment_reaction_user_comment_emoji"),
        )
        op.create_index("ix_comment_reactions_user_id", "comment_reactions", ["user_id"])
        op.create_index("ix_comment_reactions_comment_id", "comment_reactions", ["comment_id"])
        op.create_index("ix_comment_reactions_emoji", "comment_reactions", ["emoji"])

    if "message_reactions" not in tables:
        op.create_table(
            "message_reactions",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("message_id", sa.String(36), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
            sa.Column("emoji", sa.String(8), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("user_id", "message_id", "emoji", name="uq_message_reaction_user_message_emoji"),
        )
        op.create_index("ix_message_reactions_user_id", "message_reactions", ["user_id"])
        op.create_index("ix_message_reactions_message_id", "message_reactions", ["message_id"])
        op.create_index("ix_message_reactions_emoji", "message_reactions", ["emoji"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "message_reactions" in tables:
        op.drop_table("message_reactions")
    if "comment_reactions" in tables:
        op.drop_table("comment_reactions")
