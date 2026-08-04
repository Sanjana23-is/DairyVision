"""add owner_id to weather_logs

Revision ID: 20260805150000
Revises: 20260805130000
Create Date: 2026-08-05 15:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260805150000"
down_revision = "20260805130000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("weather_logs", sa.Column("owner_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.create_foreign_key("fk_weather_logs_owner_id_users", "weather_logs", "users", ["owner_id"], ["id"], ondelete="CASCADE")
    op.create_index("idx_weather_logs_owner_id", "weather_logs", ["owner_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_weather_logs_owner_id", table_name="weather_logs")
    op.drop_constraint("fk_weather_logs_owner_id_users", "weather_logs", type_="foreignkey")
    op.drop_column("weather_logs", "owner_id")
