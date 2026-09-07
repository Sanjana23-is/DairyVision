"""extend recommendations with category, priority, and linked context

Revision ID: 20260805182000
Revises: 20260805090000_user_ownership
Create Date: 2026-08-05 18:20:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260805182000'
down_revision = '20260805090000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('recommendations') as batch_op:
        batch_op.add_column(sa.Column('prediction_id', sa.UUID(as_uuid=False), nullable=True))
        batch_op.add_column(sa.Column('observation_id', sa.UUID(as_uuid=False), nullable=True))
        batch_op.add_column(sa.Column('farm_id', sa.UUID(as_uuid=False), nullable=True))
        batch_op.add_column(sa.Column('category', sa.String(length=100), nullable=False, server_default='General Farm Management'))
        batch_op.add_column(sa.Column('priority', sa.String(length=20), nullable=False, server_default='Low'))
        batch_op.create_foreign_key('fk_recommendations_prediction_id', 'milk_predictions', ['prediction_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_recommendations_observation_id', 'daily_observations', ['observation_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_recommendations_farm_id', 'farms', ['farm_id'], ['id'], ondelete='SET NULL')

    op.create_index('idx_recommendations_prediction_id', 'recommendations', ['prediction_id'])
    op.create_index('idx_recommendations_observation_id', 'recommendations', ['observation_id'])
    op.create_index('idx_recommendations_farm_id', 'recommendations', ['farm_id'])
    op.create_index('idx_recommendations_category', 'recommendations', ['category'])
    op.create_index('idx_recommendations_priority', 'recommendations', ['priority'])


def downgrade() -> None:
    op.drop_index('idx_recommendations_priority', table_name='recommendations')
    op.drop_index('idx_recommendations_category', table_name='recommendations')
    op.drop_index('idx_recommendations_farm_id', table_name='recommendations')
    op.drop_index('idx_recommendations_observation_id', table_name='recommendations')
    op.drop_index('idx_recommendations_prediction_id', table_name='recommendations')
    with op.batch_alter_table('recommendations') as batch_op:
        batch_op.drop_constraint('fk_recommendations_prediction_id', type_='foreignkey')
        batch_op.drop_constraint('fk_recommendations_observation_id', type_='foreignkey')
        batch_op.drop_constraint('fk_recommendations_farm_id', type_='foreignkey')
        batch_op.drop_column('priority')
        batch_op.drop_column('category')
        batch_op.drop_column('farm_id')
        batch_op.drop_column('observation_id')
        batch_op.drop_column('prediction_id')
