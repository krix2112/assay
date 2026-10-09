"""Data quality audit log table model."""

from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DataQualityLogRecord(Base):
    """Audit log of all validation errors, warnings, and informational observations.

    Quarantined rows with severity='error' are omitted from bhavcopy_rows and
    preserved here with full payload context in raw_row.
    """

    __tablename__ = "data_quality_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    raw_fetch_id: Mapped[int] = mapped_column(
        ForeignKey("raw_fetches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Associated raw fetch identifier",
    )
    trade_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True, comment="Trade date associated with issue"
    )
    symbol: Mapped[str | None] = mapped_column(
        String(20), nullable=True, index=True, comment="Contract symbol if identifiable"
    )
    expiry_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, comment="Contract expiry date if identifiable"
    )
    check_name: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True, comment="Stable check identifier code"
    )
    severity: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True, comment="Severity: 'error', 'warning', or 'info'"
    )
    reason: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Human-readable explanation of validation finding"
    )
    raw_row: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True, comment="Original raw row or context for auditing"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="Timestamp when issue was recorded"
    )

    __table_args__ = (Index("ix_data_quality_log_trade_date_check", "trade_date", "check_name"),)
