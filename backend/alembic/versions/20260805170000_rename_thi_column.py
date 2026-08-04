"""rename THI column to thi

Revision ID: 20260805170000
Revises: 20260805160000
Create Date: 2026-08-05 17:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260805170000"
down_revision = "20260805160000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # rename column created in initial migration from "THI" to "thi"
    with op.batch_alter_table("weather_logs") as batch_op:
        batch_op.alter_column("THI", new_column_name="thi")


def downgrade() -> None:
    with op.batch_alter_table("weather_logs") as batch_op:
        batch_op.alter_column("thi", new_column_name="THI")
