"""add pressure and cloud_cover to weather_logs

Revision ID: 20260805160000
Revises: 20260805150000
Create Date: 2026-08-05 16:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260805160000"
down_revision = "20260805150000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("weather_logs", sa.Column("pressure", sa.Numeric(8, 2), nullable=True))
    op.add_column("weather_logs", sa.Column("cloud_cover", sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("weather_logs", "cloud_cover")
    op.drop_column("weather_logs", "pressure")
