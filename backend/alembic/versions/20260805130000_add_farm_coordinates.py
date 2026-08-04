"""add farm latitude and longitude

Revision ID: 20260805130000
Revises: 20260805090000
Create Date: 2026-08-05 13:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260805130000"
down_revision = "20260805090000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "farms",
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=True),
    )
    op.add_column(
        "farms",
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("farms", "longitude")
    op.drop_column("farms", "latitude")
