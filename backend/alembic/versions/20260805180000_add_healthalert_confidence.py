"""add health alert confidence

Revision ID: 20260805180000
Revises: 20260805170000_rename_thi_column
Create Date: 2026-08-05 18:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260805180000'
down_revision = '20260805170000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('health_alerts', sa.Column('confidence', sa.Numeric(5, 4), nullable=False, server_default='0.0'))
    op.create_index('idx_health_alerts_confidence', 'health_alerts', ['confidence'])


def downgrade() -> None:
    op.drop_index('idx_health_alerts_confidence', table_name='health_alerts')
    op.drop_column('health_alerts', 'confidence')
