"""Backtest API endpoints (Stage S9)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.backtest import (
    BacktestDailyRecord,
    BacktestRunRecord,
    BacktestTradeRecord,
)

router = APIRouter(prefix="/backtest", tags=["backtest"])


class BacktestDailyItemResponse(BaseModel):
    """Daily equity curve point for backtest."""

    model_config = ConfigDict(from_attributes=True)

    trade_date: date
    strategy_pnl: Decimal
    gross_pnl: Decimal
    costs: Decimal
    gold_return: Decimal | None
    open_positions: int


class BacktestTradeItemResponse(BaseModel):
    """Individual trade record in backtest."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_date: date
    exit_date: date
    symbol_a: str
    expiry_a: date
    symbol_b: str
    expiry_b: date
    direction: str
    lots_a: int
    lots_b: int
    entry_spread_bps: Decimal
    exit_spread_bps: Decimal
    gross_pnl: Decimal
    costs: Decimal
    net_pnl: Decimal
    exit_reason: str
    residual_gram_mismatch: Decimal


class BacktestLatestResponse(BaseModel):
    """Detailed response for latest backtest run."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    code_version: str
    params: dict[str, Any]
    data_from: date
    data_to: date
    train_to: date
    status: str
    summary: dict[str, Any]
    equity_curve: list[BacktestDailyItemResponse]
    trades: list[BacktestTradeItemResponse]


@router.get(
    "/latest",
    response_model=BacktestLatestResponse,
    summary="Get the most recent backtest run",
    description=(
        "Returns summary, daily equity curve, and executed trades "
        "for the latest backtest simulation."
    ),
)
def get_latest_backtest(
    db: Session = Depends(get_db),
) -> BacktestLatestResponse:
    """Retrieve the latest backtest run."""
    run_stmt = select(BacktestRunRecord).order_by(BacktestRunRecord.created_at.desc()).limit(1)
    run_record = db.execute(run_stmt).scalar_one_or_none()

    if run_record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No backtest runs found",
        )

    daily_stmt = (
        select(BacktestDailyRecord)
        .where(BacktestDailyRecord.run_id == run_record.id)
        .order_by(BacktestDailyRecord.trade_date.asc())
    )
    daily_records = list(db.execute(daily_stmt).scalars().all())

    trades_stmt = (
        select(BacktestTradeRecord)
        .where(BacktestTradeRecord.run_id == run_record.id)
        .order_by(BacktestTradeRecord.entry_date.asc(), BacktestTradeRecord.id.asc())
    )
    trade_records = list(db.execute(trades_stmt).scalars().all())

    return BacktestLatestResponse(
        id=run_record.id,
        created_at=run_record.created_at,
        code_version=run_record.code_version,
        params=run_record.params,
        data_from=run_record.data_from,
        data_to=run_record.data_to,
        train_to=run_record.train_to,
        status=run_record.status,
        summary=run_record.summary,
        equity_curve=[BacktestDailyItemResponse.model_validate(d) for d in daily_records],
        trades=[BacktestTradeItemResponse.model_validate(t) for t in trade_records],
    )
