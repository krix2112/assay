"""Spreads table model (Stage S7)."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SpreadRecord(Base):
    """Pair spread records and rolling robust statistics.

    Pairs compare contracts of different symbols using fine_gold_price_per_gram.
    FK-free table.
    """

    __tablename__ = "spreads"

    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    symbol_a: Mapped[str] = mapped_column(String(20), primary_key=True)
    expiry_a: Mapped[date] = mapped_column(Date, primary_key=True)
    symbol_b: Mapped[str] = mapped_column(String(20), primary_key=True)
    expiry_b: Mapped[date] = mapped_column(Date, primary_key=True)

    expiry_gap_days: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Calendar day gap between expiry_a and expiry_b"
    )
    spread_bps: Mapped[Decimal] = mapped_column(
        Numeric, nullable=False, comment="Spread in basis points = (a - b) / b * 10000"
    )
    rolling_median_bps: Mapped[Decimal | None] = mapped_column(
        Numeric, nullable=True, comment="Rolling median spread_bps over lookback days"
    )
    rolling_mad_bps: Mapped[Decimal | None] = mapped_column(
        Numeric, nullable=True, comment="Rolling Median Absolute Deviation (MAD)"
    )
    robust_z: Mapped[Decimal | None] = mapped_column(
        Numeric, nullable=True, comment="Robust z-score = (spread - median) / (1.4826 * MAD)"
    )
    history_days: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Prior trading days with data for this pair in lookback"
    )
    weaker_liquidity_label: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="Weaker liquidity label between contract A and B"
    )
    method_version: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="Analytics methodology version"
    )

    __table_args__ = (
        Index("ix_spreads_trade_date", "trade_date"),
        Index("ix_spreads_pair", "symbol_a", "expiry_a", "symbol_b", "expiry_b"),
    )
