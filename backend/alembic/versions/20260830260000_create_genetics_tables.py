"""create_genetics_tables

Revision ID: 20260830260000
Revises: 20260830250000
Create Date: 2026-08-30 26:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260830260000'
down_revision: Union[str, None] = '20260830250000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sire_master',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('sire_code', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('breed_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('peak_yield_kg', sa.Float(), nullable=True),
        sa.Column('days_to_peak', sa.Integer(), nullable=True),
        sa.Column('lactation_length_days', sa.Integer(), nullable=True),
        sa.Column('total_milk_yield_kg', sa.Float(), nullable=True),
        sa.Column('genetic_merit_score', sa.Float(), nullable=False, server_default='85.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['breed_id'], ['breed_master.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sire_code')
    )
    op.create_index(op.f('ix_sire_master_sire_code'), 'sire_master', ['sire_code'], unique=True)

    op.add_column('cows', sa.Column('sire_id', sa.UUID(as_uuid=False), nullable=True))
    op.add_column('cows', sa.Column('dam_name', sa.String(255), nullable=True))
    op.create_foreign_key('fk_cows_sire_id', 'cows', 'sire_master', ['sire_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_cows_sire_id', 'cows', type_='foreignkey')
    op.drop_column('cows', 'dam_name')
    op.drop_column('cows', 'sire_id')
    op.drop_index(op.f('ix_sire_master_sire_code'), table_name='sire_master')
    op.drop_table('sire_master')
