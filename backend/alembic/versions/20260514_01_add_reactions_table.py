"""add reactions table

Revision ID: 20260514_01
Revises: 0003_product_upgrade
Create Date: 2026-05-14 00:15:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260514_01'
down_revision: Union[str, None] = '0003_product_upgrade'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'reactions' in inspector.get_table_names():
        return

    op.create_table(
        'reactions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('post_id', sa.String(36), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('emoji', sa.String(8), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'post_id', 'emoji', name='uq_reaction_user_post_emoji'),
    )


def downgrade() -> None:
    op.drop_table('reactions')
