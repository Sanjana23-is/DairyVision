"""add updated_at to daily_observations

Revision ID: 20260805200000
Revises: 20260805190000
Create Date: 2026-08-05 20:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260805200000"
down_revision = "20260805190000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add updated_at with server default now()
    op.add_column(
        "daily_observations",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_column("daily_observations", "updated_at")
