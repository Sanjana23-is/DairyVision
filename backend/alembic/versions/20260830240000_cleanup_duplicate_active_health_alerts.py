"""cleanup_duplicate_active_health_alerts

Revision ID: 20260830240000
Revises: 20260830230000
Create Date: 2026-08-30 24:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260830240000'
down_revision: Union[str, None] = '20260830230000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQL data cleanup to mark older active duplicate health alerts as resolved
    # Group by cow_id and alert_type where resolved is False
    op.execute("""
        WITH ranked_alerts AS (
            SELECT id,
                   cow_id,
                   alert_type,
                   ROW_NUMBER() OVER (
                       PARTITION BY cow_id, alert_type
                       ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC, id DESC
                   ) as rn
            FROM health_alerts
            WHERE resolved = FALSE
        )
        UPDATE health_alerts
        SET resolved = TRUE
        WHERE id IN (
            SELECT id FROM ranked_alerts WHERE rn > 1
        );
    """)


def downgrade() -> None:
    pass
