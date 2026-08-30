"""add_anomaly_id_to_recommendations

Revision ID: 20260830210000
Revises: 20260830200000
Create Date: 2026-08-30 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260830210000'
down_revision: Union[str, None] = '20260830200000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('recommendations', sa.Column('anomaly_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_recommendations_anomaly_id', 'recommendations', 'anomaly_records', ['anomaly_id'], ['id'], ondelete='SET NULL')
    op.create_index('idx_recommendations_anomaly_id', 'recommendations', ['anomaly_id'])


def downgrade() -> None:
    op.drop_index('idx_recommendations_anomaly_id', table_name='recommendations')
    op.drop_constraint('fk_recommendations_anomaly_id', 'recommendations', type_='foreignkey')
    op.drop_column('recommendations', 'anomaly_id')
