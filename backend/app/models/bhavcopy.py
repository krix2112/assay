"""MCX Bhavcopy market data table model."""

from datetime import date
from decimal import Decimal

from sqlalchemy import BigInteger, Date, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BhavcopyRowRecord(Base):
    """Normalized MCX Bhavcopy market row for gold futures contracts.

    Composite primary key: (symbol, expiry_date, trade_date).
    Assay evaluates individual contract expiries discretely and never builds
    a continuous near-month synthetic series.
    """

    __tablename__ = "bhavcopy_rows"

    symbol: Mapped[str] = mapped_column(
        String(20), primary_key=True, comment="Normalized contract symbol (GOLDM, etc.)"
    )
    expiry_date: Mapped[date] = mapped_column(
        Date, primary_key=True, comment="Specific contract expiry date"
    )
    trade_date: Mapped[date] = mapped_column(
        Date, primary_key=True, index=True, comment="Actual trading date on MCX"
    )
    open: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, comment="Opening price (INR)"
    )
    high: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, comment="Highest traded price (INR)"
    )
    low: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, comment="Lowest traded price (INR)"
    )
    close: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, comment="Closing / settlement price (INR)"
    )
    volume: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="Traded contract volume"
    )
    open_interest: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="Open interest in contracts"
    )
    raw_fetch_id: Mapped[int] = mapped_column(
        ForeignKey("raw_fetches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Foreign key linking row to source raw fetch audit",
    )

    __table_args__ = (Index("ix_bhavcopy_rows_symbol_trade_date", "symbol", "trade_date"),)
