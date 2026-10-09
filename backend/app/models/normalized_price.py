"""Normalized gold prices table model (Stage S5)."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKeyConstraint, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NormalizedPriceRecord(Base):
    """Normalized gold price metrics calculated per contract.

    Quotation basis and purity treatment come from the challenge brief and are
    NOT yet verified against the MCX contract specification. Both the plain and
    the purity-adjusted value are stored so the effect of the adjustment stays visible.
    """

    __tablename__ = "prices_normalized"

    symbol: Mapped[str] = mapped_column(String(20), primary_key=True)
    expiry_date: Mapped[date] = mapped_column(Date, primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True, index=True)

    close_price: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, comment="Settlement close price from bhavcopy"
    )
    price_per_gram: Mapped[Decimal] = mapped_column(
        Numeric, nullable=False, comment="Close divided by quote_unit_grams"
    )
    fine_gold_price_per_gram: Mapped[Decimal] = mapped_column(
        Numeric, nullable=False, comment="price_per_gram divided by purity fraction"
    )
    method_version: Mapped[str] = mapped_column(
        String(20), nullable=False, default="v1", comment="Normalization methodology version"
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="Timestamp when normalized"
    )

    __table_args__ = (
        ForeignKeyConstraint(
            ["symbol", "expiry_date", "trade_date"],
            ["bhavcopy_rows.symbol", "bhavcopy_rows.expiry_date", "bhavcopy_rows.trade_date"],
            ondelete="CASCADE",
        ),
        Index("ix_prices_normalized_symbol_trade_date", "symbol", "trade_date"),
    )
