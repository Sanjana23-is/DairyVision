"""add_anomaly_records_table

Revision ID: 20260830200000
Revises: 20260830190000
Create Date: 2026-08-30 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260830200000'
down_revision: Union[str, None] = '20260830190000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'anomaly_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('cow_id', sa.UUID(), nullable=False),
        sa.Column('observation_id', sa.UUID(), nullable=True),
        sa.Column('farm_id', sa.UUID(), nullable=False),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('anomaly_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('severity', sa.String(length=20), nullable=False, server_default='Normal'),
        sa.Column('anomaly_type', sa.String(length=50), nullable=False, server_default='composite'),
        sa.Column('issue_tags', sa.JSON(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('detected_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('resolved', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['cow_id'], ['cows.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['observation_id'], ['daily_observations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['farm_id'], ['farms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index('ix_anomaly_records_cow_id', 'anomaly_records', ['cow_id'])
    op.create_index('ix_anomaly_records_farm_id', 'anomaly_records', ['farm_id'])
    op.create_index('ix_anomaly_records_owner_id', 'anomaly_records', ['owner_id'])
    op.create_index('ix_anomaly_records_observation_id', 'anomaly_records', ['observation_id'])


def downgrade() -> None:
    op.drop_index('ix_anomaly_records_observation_id', table_name='anomaly_records')
    op.drop_index('ix_anomaly_records_owner_id', table_name='anomaly_records')
    op.drop_index('ix_anomaly_records_farm_id', table_name='anomaly_records')
    op.drop_index('ix_anomaly_records_cow_id', table_name='anomaly_records')
    op.drop_table('anomaly_records')
