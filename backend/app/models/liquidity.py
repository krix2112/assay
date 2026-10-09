"""Liquidity confidence scores table model (Stage S6)."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LiquidityScoreRecord(Base):
    """Liquidity confidence metrics and classification for MCX gold contracts.

    Thresholds are judgement parameters, not validated against real fills.
    Volume is not market depth; the label means informational vs plausibly
    tradeable, not a guarantee of execution.
    """

    __tablename__ = "liquidity_scores"

    symbol: Mapped[str] = mapped_column(String(20), primary_key=True)
    expiry_date: Mapped[date] = mapped_column(Date, primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True, index=True)

    volume: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="Traded contract volume"
    )
    open_interest: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="Open interest in contracts"
    )
    volume_ratio: Mapped[Decimal | None] = mapped_column(
        Numeric, nullable=True, comment="Volume relative to lookback median"
    )
    oi_ratio: Mapped[Decimal | None] = mapped_column(
        Numeric, nullable=True, comment="Open interest relative to lookback median"
    )
    days_to_expiry: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Calendar days remaining until contract expiry"
    )
    history_days: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Prior trading days available in lookback window"
    )
    label: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Confidence label: High, Medium, Low, Untradeable, Unknown",
    )
    reason: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Detailed explanation of score determination"
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="Timestamp when score was calculated"
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["symbol", "expiry_date", "trade_date"],
            ["bhavcopy_rows.symbol", "bhavcopy_rows.expiry_date", "bhavcopy_rows.trade_date"],
            ondelete="CASCADE",
        ),
        Index("ix_liquidity_scores_symbol_trade_date", "symbol", "trade_date"),
    )
