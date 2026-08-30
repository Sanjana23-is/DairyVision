"""add completed flag to recommendations

Revision ID: 20260805220000
Revises: 20260805210000
Create Date: 2026-08-05 22:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260805220000"
down_revision = "20260805210000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("recommendations") as batch_op:
        batch_op.add_column(
            sa.Column(
                "completed",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("false"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("recommendations") as batch_op:
        batch_op.drop_column("completed")
