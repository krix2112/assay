"""Contract specifications table model."""

from decimal import Decimal

from sqlalchemy import Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ContractSpec(Base):
    """Specification metadata for MCX gold futures contracts.

    Source notes specify derivation origin (e.g. hackathon challenge brief vs exchange circular).
    """

    __tablename__ = "contract_specs"

    symbol: Mapped[str] = mapped_column(String(20), primary_key=True)
    trading_unit_grams: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, comment="Trading unit size in grams"
    )
    quote_unit_grams: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), nullable=False, comment="Price quotation unit in grams"
    )
    purity: Mapped[Decimal] = mapped_column(
        Numeric(6, 4), nullable=False, comment="Gold purity fraction (e.g. 0.995, 0.999)"
    )
    expiry_window_start_day: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Expected earliest day-of-month for contract expiry"
    )
    expiry_window_end_day: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Expected latest day-of-month for contract expiry"
    )
    source_note: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Provenance and verification note"
    )
