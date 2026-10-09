"""Parity score table model (Stage S8)."""

from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ParityScoreRecord(Base):
    """Daily gold market parity score record.

    Score indicates consistency across MCX gold contract forms.
    """

    __tablename__ = "parity_scores"

    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    score: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="Parity score [0, 100], NULL if insufficient data"
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="Status: 'ok' or 'insufficient_data'"
    )
    pairs_used: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Count of pairs contributing to the score"
    )
    explanation: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Plain sentence explaining the score"
    )
    details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="Breakdown of usable and excluded pairs"
    )
    method_version: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="Analytics methodology version"
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="Timestamp when score was calculated"
    )
