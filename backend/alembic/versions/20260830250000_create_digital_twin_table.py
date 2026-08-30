"""create_digital_twin_table

Revision ID: 20260830250000
Revises: 20260830240000
Create Date: 2026-08-30 25:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260830250000'
down_revision: Union[str, None] = '20260830240000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'digital_twin_states',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('cow_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('farm_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('owner_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('vitality_score', sa.Float(), nullable=False, server_default='100.0'),
        sa.Column('health_status', sa.String(), nullable=False, server_default='Healthy'),
        sa.Column('heat_stress_level', sa.String(), nullable=False, server_default='Comfort'),
        sa.Column('status_summary', sa.Text(), nullable=True),
        sa.Column('state_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['cow_id'], ['cows.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['farm_id'], ['farms.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_digital_twin_states_cow_id'), 'digital_twin_states', ['cow_id'], unique=False)
    op.create_index(op.f('ix_digital_twin_states_owner_id'), 'digital_twin_states', ['owner_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_digital_twin_states_owner_id'), table_name='digital_twin_states')
    op.drop_index(op.f('ix_digital_twin_states_cow_id'), table_name='digital_twin_states')
    op.drop_table('digital_twin_states')
