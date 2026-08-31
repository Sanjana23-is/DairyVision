"""add_farm_financial_settings

Revision ID: 20260831000000
Revises: 20260830260000
Create Date: 2026-08-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260831000000'
down_revision: Union[str, None] = '20260830260000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('farm_settings', sa.Column('milk_price_per_liter', sa.Float(), nullable=True))
    op.add_column('farm_settings', sa.Column('feed_cost_per_kg', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('farm_settings', 'feed_cost_per_kg')
    op.drop_column('farm_settings', 'milk_price_per_liter')
