"""add age_months to cows

Revision ID: 20260830180000
Revises: 20260805220000
Create Date: 2026-08-30 18:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260830180000"
down_revision = "20260805220000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("cows") as batch_op:
        batch_op.add_column(
            sa.Column("age_months", sa.Integer(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("cows") as batch_op:
        batch_op.drop_column("age_months")
