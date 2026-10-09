from datetime import date, datetime
from typing import Any

from sqlalchemy import BigInteger, Date, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TrackRecordEntry(Base):
    """Immutable hash-chained track record row."""

    __tablename__ = "track_record"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    record: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="Derived track record payload (never raw prices)"
    )
    canonical_json: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Canonical deterministic JSON representation"
    )
    prev_hash: Mapped[str | None] = mapped_column(
        Text, nullable=True, comment="SHA-256 hash of previous row in insertion order"
    )
    hash: Mapped[str] = mapped_column(
        Text, nullable=False, unique=True, index=True, comment="SHA-256(canonical_json + prev_hash)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="Timestamp when record was appended"
    )

    __table_args__ = (
        UniqueConstraint("trade_date", "revision", name="uq_track_record_trade_date_revision"),
    )


class BriefSentRecord(Base):
    """Audit log of delivered daily briefs."""

    __tablename__ = "briefs_sent"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    trade_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    error_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
