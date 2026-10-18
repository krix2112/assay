"""Make bhavcopy_rows open, high, low nullable for untraded contracts.

Revision ID: d8924b17f512
Revises: c3d7f98a12e4
Create Date: 2026-10-17 11:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8924b17f512"
down_revision: str | None = "c3d7f98a12e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Alter open, high, low columns in bhavcopy_rows to be nullable."""
    op.alter_column(
        "bhavcopy_rows",
        "open",
        existing_type=sa.Numeric(precision=14, scale=4),
        nullable=True,
    )
    op.alter_column(
        "bhavcopy_rows",
        "high",
        existing_type=sa.Numeric(precision=14, scale=4),
        nullable=True,
    )
    op.alter_column(
        "bhavcopy_rows",
        "low",
        existing_type=sa.Numeric(precision=14, scale=4),
        nullable=True,
    )


def downgrade() -> None:
    """Revert open, high, low columns in bhavcopy_rows to be NOT NULL."""
    op.alter_column(
        "bhavcopy_rows",
        "low",
        existing_type=sa.Numeric(precision=14, scale=4),
        nullable=False,
    )
    op.alter_column(
        "bhavcopy_rows",
        "high",
        existing_type=sa.Numeric(precision=14, scale=4),
        nullable=False,
    )
    op.alter_column(
        "bhavcopy_rows",
        "open",
        existing_type=sa.Numeric(precision=14, scale=4),
        nullable=False,
    )
