"""add_updated_at_to_health_alerts

Revision ID: 20260830230000
Revises: 20260830220000
Create Date: 2026-08-30 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260830230000'
down_revision: Union[str, None] = '20260830220000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('health_alerts', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()))


def downgrade() -> None:
    op.drop_column('health_alerts', 'updated_at')
