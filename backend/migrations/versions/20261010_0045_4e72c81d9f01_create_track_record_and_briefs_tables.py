"""create_track_record_and_briefs_tables

Revision ID: 4e72c81d9f01
Revises: 15f1e0c44397
Create Date: 2026-10-10 00:45:00.000000+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.models.track_record_ddl import (
    apply_track_record_triggers,
    drop_track_record_triggers,
)

# revision identifiers, used by Alembic.
revision: str = "4e72c81d9f01"
down_revision: str | None = "15f1e0c44397"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Create track_record table
    op.create_table(
        "track_record",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False, comment="Trading date for record"),
        sa.Column(
            "revision",
            sa.Integer(),
            nullable=False,
            server_default="1",
            comment="Revision number (starts at 1)",
        ),
        sa.Column(
            "record",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            comment="Derived metrics payload (never raw prices)",
        ),
        sa.Column(
            "canonical_json",
            sa.Text(),
            nullable=False,
            comment="Deterministic canonical JSON representation",
        ),
        sa.Column(
            "prev_hash",
            sa.Text(),
            nullable=True,
            comment="SHA-256 hash of previous row in id order",
        ),
        sa.Column(
            "hash",
            sa.Text(),
            nullable=False,
            comment="SHA-256(canonical_json + prev_hash)",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="Timestamp when record was appended",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trade_date", "revision", name="uq_track_record_trade_date_revision"),
        sa.UniqueConstraint("hash", name="uq_track_record_hash"),
    )
    op.create_index("ix_track_record_trade_date", "track_record", ["trade_date"], unique=False)

    # 2. Create briefs_sent audit table
    op.create_table(
        "briefs_sent",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False, comment="Trading date of the brief"),
        sa.Column(
            "channel",
            sa.String(length=32),
            nullable=False,
            comment="Delivery channel (telegram, email, dry_run)",
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            comment="Delivery status (sent, failed, dry_run)",
        ),
        sa.Column(
            "error_text",
            sa.Text(),
            nullable=True,
            comment="Sanitized delivery error message",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="Timestamp of delivery attempt",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_briefs_sent_trade_date", "briefs_sent", ["trade_date"], unique=False)

    # 3. Create schema-agnostic trigger function and append-only triggers
    apply_track_record_triggers(op.get_bind())


def downgrade() -> None:
    # 1. Drop triggers and trigger function
    drop_track_record_triggers(op.get_bind())

    # 2. Drop tables
    op.drop_index("ix_briefs_sent_trade_date", table_name="briefs_sent")
    op.drop_table("briefs_sent")
    op.drop_index("ix_track_record_trade_date", table_name="track_record")
    op.drop_table("track_record")
