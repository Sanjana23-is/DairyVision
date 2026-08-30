"""add health fields to daily_observations

Revision ID: 20260830190000
Revises: 20260830180000
Create Date: 2026-08-30 19:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260830190000"
down_revision = "20260830180000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("daily_observations") as batch_op:
        batch_op.add_column(
            sa.Column("health_condition", sa.String(length=50), nullable=True, server_default="normal")
        )
        batch_op.add_column(
            sa.Column("body_temperature_c", sa.Numeric(precision=4, scale=2), nullable=True)
        )
        batch_op.add_column(
            sa.Column("body_condition_score", sa.Numeric(precision=3, scale=2), nullable=True)
        )
        batch_op.add_column(
            sa.Column("health_notes", sa.Text(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("daily_observations") as batch_op:
        batch_op.drop_column("health_notes")
        batch_op.drop_column("body_condition_score")
        batch_op.drop_column("body_temperature_c")
        batch_op.drop_column("health_condition")
