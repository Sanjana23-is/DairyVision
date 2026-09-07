"""add_why_reason_to_recommendations

Revision ID: 20260830220000
Revises: 20260830210000
Create Date: 2026-08-30 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260830220000'
down_revision: Union[str, None] = '20260830210000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('recommendations', sa.Column('why_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('recommendations', 'why_reason')
