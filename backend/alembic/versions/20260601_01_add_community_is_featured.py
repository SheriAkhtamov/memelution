"""add is_featured to communities

Revision ID: 20260601_01
Revises: 20260523_01
Create Date: 2026-06-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260601_01"
down_revision = "20260523_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "communities",
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")),
    )
    op.create_index(
        "ix_communities_is_featured",
        "communities",
        ["is_featured"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_communities_is_featured", table_name="communities")
    op.drop_column("communities", "is_featured")
