"""merge heads and add weather_log_id to daily_observations

Revision ID: 20260805190000
Revises: 20260805180000, 20260805182000
Create Date: 2026-08-05 19:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260805190000"
down_revision = ("20260805180000", "20260805182000")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable UUID column
    op.add_column(
        "daily_observations",
        sa.Column("weather_log_id", sa.UUID(as_uuid=False), nullable=True),
    )

    # create foreign key constraint to weather_logs.id
    op.create_foreign_key(
        "fk_daily_observations_weather_log_id",
        "daily_observations",
        "weather_logs",
        ["weather_log_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # add index for quicker lookups
    op.create_index("idx_daily_observations_weather_log_id", "daily_observations", ["weather_log_id"])


def downgrade() -> None:
    # remove index, constraint, and column
    op.drop_index("idx_daily_observations_weather_log_id", table_name="daily_observations")
    with op.batch_alter_table("daily_observations") as batch_op:
        batch_op.drop_constraint("fk_daily_observations_weather_log_id", type_="foreignkey")
        batch_op.drop_column("weather_log_id")
