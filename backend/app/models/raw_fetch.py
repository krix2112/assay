"""Raw fetch audit table model."""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RawFetchRecord(Base):
    """Audit log of all raw exchange payloads imported into Assay."""

    __tablename__ = "raw_fetches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    requested_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, comment="The calendar date requested by system/user"
    )
    returned_trade_date: Mapped[date | None] = mapped_column(
        Date, nullable=True, comment="The true trade date contained in exchange payload"
    )
    acquisition_method: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Method of acquisition"
    )
    source_name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Original source filename or URI"
    )
    sha256: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        comment="SHA-256 hash of raw byte payload for idempotency",
    )
    archive_path: Mapped[str] = mapped_column(
        String(512), nullable=False, comment="Local path to archived byte payload"
    )
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="UTC timestamp when imported"
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="File-level processing status ('success', 'date_mismatch', 'no_data')",
    )
    row_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, comment="Total valid rows parsed from file"
    )
