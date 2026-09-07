"""add prediction, observation, and farm links to health alerts

Revision ID: 20260805210000
Revises: 20260805200000
Create Date: 2026-08-05 21:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260805210000'
down_revision = '20260805200000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('health_alerts') as batch_op:
        batch_op.add_column(sa.Column('prediction_id', sa.UUID(as_uuid=False), nullable=True))
        batch_op.add_column(sa.Column('observation_id', sa.UUID(as_uuid=False), nullable=True))
        batch_op.add_column(sa.Column('farm_id', sa.UUID(as_uuid=False), nullable=True))
        batch_op.create_foreign_key('fk_health_alerts_prediction_id', 'milk_predictions', ['prediction_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_health_alerts_observation_id', 'daily_observations', ['observation_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_health_alerts_farm_id', 'farms', ['farm_id'], ['id'], ondelete='SET NULL')

    op.create_index('idx_health_alerts_prediction_id', 'health_alerts', ['prediction_id'])
    op.create_index('idx_health_alerts_observation_id', 'health_alerts', ['observation_id'])
    op.create_index('idx_health_alerts_farm_id', 'health_alerts', ['farm_id'])


def downgrade() -> None:
    op.drop_index('idx_health_alerts_farm_id', table_name='health_alerts')
    op.drop_index('idx_health_alerts_observation_id', table_name='health_alerts')
    op.drop_index('idx_health_alerts_prediction_id', table_name='health_alerts')
    with op.batch_alter_table('health_alerts') as batch_op:
        batch_op.drop_constraint('fk_health_alerts_farm_id', type_='foreignkey')
        batch_op.drop_constraint('fk_health_alerts_observation_id', type_='foreignkey')
        batch_op.drop_constraint('fk_health_alerts_prediction_id', type_='foreignkey')
        batch_op.drop_column('farm_id')
        batch_op.drop_column('observation_id')
        batch_op.drop_column('prediction_id')
