"""widen_raw_fetches_acquisition_method

Revision ID: c3d7f98a12e4
Revises: 4e72c81d9f01
Create Date: 2026-10-17 10:30:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d7f98a12e4"
down_revision: str | None = "4e72c81d9f01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "raw_fetches",
        "acquisition_method",
        existing_type=sa.String(length=50),
        type_=sa.String(length=100),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "raw_fetches",
        "acquisition_method",
        existing_type=sa.String(length=100),
        type_=sa.String(length=50),
        existing_nullable=False,
    )
