"""Backtest models for Stage S9."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BacktestRunRecord(Base):
    """Execution record for a walk-forward backtest simulation."""

    __tablename__ = "backtest_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="Timestamp when simulation was initiated"
    )
    code_version: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="Backtest strategy code version"
    )
    params: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="Strategy parameters dictionary"
    )
    data_from: Mapped[date] = mapped_column(
        Date, nullable=False, comment="Earliest trade date in the evaluation dataset"
    )
    data_to: Mapped[date] = mapped_column(
        Date, nullable=False, comment="Latest trade date in the evaluation dataset"
    )
    train_to: Mapped[date] = mapped_column(
        Date, nullable=False, comment="Cutoff trade date for training window (inclusive)"
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, comment="Simulation status ('completed', 'failed', etc.)"
    )
    summary: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="Summary performance metrics and attribution"
    )

    __table_args__ = (Index("ix_backtest_runs_data_range", "data_from", "data_to"),)


class BacktestDailyRecord(Base):
    """Daily performance and portfolio state for a backtest run."""

    __tablename__ = "backtest_daily"

    run_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trade_date: Mapped[date] = mapped_column(Date, primary_key=True)
    strategy_pnl: Mapped[Decimal] = mapped_column(
        Numeric, nullable=False, comment="Net daily strategy P&L (gross minus costs)"
    )
    gross_pnl: Mapped[Decimal] = mapped_column(
        Numeric, nullable=False, comment="Gross daily strategy P&L"
    )
    costs: Mapped[Decimal] = mapped_column(
        Numeric, nullable=False, comment="Transaction and slippage costs incurred on trade_date"
    )
    gold_return: Mapped[Decimal | None] = mapped_column(
        Numeric, nullable=True, comment="Equal-weight mean daily fine gold return across contracts"
    )
    open_positions: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="Count of active open pair positions"
    )

    __table_args__ = (
        ForeignKeyConstraint(["run_id"], ["backtest_runs.id"], ondelete="CASCADE"),
        Index("ix_backtest_daily_run_date", "run_id", "trade_date"),
    )


class BacktestTradeRecord(Base):
    """Individual trade execution lifecycle in a backtest run."""

    __tablename__ = "backtest_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(36), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    exit_date: Mapped[date] = mapped_column(Date, nullable=False)
    symbol_a: Mapped[str] = mapped_column(String(20), nullable=False)
    expiry_a: Mapped[date] = mapped_column(Date, nullable=False)
    symbol_b: Mapped[str] = mapped_column(String(20), nullable=False)
    expiry_b: Mapped[date] = mapped_column(Date, nullable=False)
    direction: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="Direction: 'long_a_short_b' or 'long_b_short_a'"
    )
    lots_a: Mapped[int] = mapped_column(Integer, nullable=False)
    lots_b: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_spread_bps: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    exit_spread_bps: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    gross_pnl: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    costs: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    net_pnl: Mapped[Decimal] = mapped_column(Numeric, nullable=False)
    exit_reason: Mapped[str] = mapped_column(String(50), nullable=False)
    residual_gram_mismatch: Mapped[Decimal] = mapped_column(
        Numeric, nullable=False, comment="Unhedged gold exposure = long_grams - short_grams"
    )

    __table_args__ = (
        ForeignKeyConstraint(["run_id"], ["backtest_runs.id"], ondelete="CASCADE"),
        Index("ix_backtest_trades_run_id", "run_id"),
    )
