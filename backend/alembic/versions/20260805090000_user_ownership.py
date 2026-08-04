"""add user ownership columns

Revision ID: 20260805090000
Revises: 20260804120000
Create Date: 2026-08-05 09:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260805090000"
down_revision = "20260804120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cows", sa.Column("owner_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key("fk_cows_owner_id_users", "cows", "users", ["owner_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_cows_owner_id", "cows", ["owner_id"], unique=False)

    op.add_column("daily_observations", sa.Column("owner_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key("fk_daily_observations_owner_id_users", "daily_observations", "users", ["owner_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_daily_observations_owner_id", "daily_observations", ["owner_id"], unique=False)

    op.add_column("health_alerts", sa.Column("owner_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key("fk_health_alerts_owner_id_users", "health_alerts", "users", ["owner_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_health_alerts_owner_id", "health_alerts", ["owner_id"], unique=False)

    op.add_column("milk_predictions", sa.Column("owner_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key("fk_milk_predictions_owner_id_users", "milk_predictions", "users", ["owner_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_milk_predictions_owner_id", "milk_predictions", ["owner_id"], unique=False)

    op.add_column("recommendations", sa.Column("owner_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key("fk_recommendations_owner_id_users", "recommendations", "users", ["owner_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_recommendations_owner_id", "recommendations", ["owner_id"], unique=False)

    op.add_column("activity_logs", sa.Column("owner_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key("fk_activity_logs_owner_id_users", "activity_logs", "users", ["owner_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_activity_logs_owner_id", "activity_logs", ["owner_id"], unique=False)

    op.execute("UPDATE cows SET owner_id = created_by WHERE owner_id IS NULL AND created_by IS NOT NULL")
    op.execute("UPDATE daily_observations SET owner_id = observed_by WHERE owner_id IS NULL AND observed_by IS NOT NULL")
    op.execute("UPDATE activity_logs SET owner_id = user_id WHERE owner_id IS NULL AND user_id IS NOT NULL")

    op.alter_column("cows", "owner_id", nullable=False)
    op.alter_column("daily_observations", "owner_id", nullable=False)
    op.alter_column("health_alerts", "owner_id", nullable=False)
    op.alter_column("milk_predictions", "owner_id", nullable=False)
    op.alter_column("recommendations", "owner_id", nullable=False)
    op.alter_column("activity_logs", "owner_id", nullable=False)


def downgrade() -> None:
    op.drop_index("idx_activity_logs_owner_id", table_name="activity_logs")
    op.drop_constraint("fk_activity_logs_owner_id_users", "activity_logs", type_="foreignkey")
    op.drop_column("activity_logs", "owner_id")

    op.drop_index("idx_recommendations_owner_id", table_name="recommendations")
    op.drop_constraint("fk_recommendations_owner_id_users", "recommendations", type_="foreignkey")
    op.drop_column("recommendations", "owner_id")

    op.drop_index("idx_milk_predictions_owner_id", table_name="milk_predictions")
    op.drop_constraint("fk_milk_predictions_owner_id_users", "milk_predictions", type_="foreignkey")
    op.drop_column("milk_predictions", "owner_id")

    op.drop_index("idx_health_alerts_owner_id", table_name="health_alerts")
    op.drop_constraint("fk_health_alerts_owner_id_users", "health_alerts", type_="foreignkey")
    op.drop_column("health_alerts", "owner_id")

    op.drop_index("idx_daily_observations_owner_id", table_name="daily_observations")
    op.drop_constraint("fk_daily_observations_owner_id_users", "daily_observations", type_="foreignkey")
    op.drop_column("daily_observations", "owner_id")

    op.drop_index("idx_cows_owner_id", table_name="cows")
    op.drop_constraint("fk_cows_owner_id_users", "cows", type_="foreignkey")
    op.drop_column("cows", "owner_id")
