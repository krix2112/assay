"""Contracts day summary API route."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.liquidity import LiquidityScoreRecord
from app.models.normalized_price import NormalizedPriceRecord

router = APIRouter(prefix="/contracts", tags=["contracts"])


class ContractDayItemResponse(BaseModel):
    """Normalized metrics and liquidity confidence for a single contract expiry."""

    model_config = ConfigDict(from_attributes=True)

    symbol: str
    expiry_date: str
    trade_date: str
    close: Decimal
    price_per_gram: Decimal | None = None
    fine_gold_price_per_gram: Decimal | None = None
    volume: int
    open_interest: int
    volume_ratio: Decimal | None = None
    oi_ratio: Decimal | None = None
    days_to_expiry: int
    history_days: int | None = None
    label: str | None = None
    reason: str | None = None


@router.get(
    "/{date_str}",
    response_model=list[ContractDayItemResponse],
    summary="Get contract market and derived metrics for a specific date",
    description=(
        "Returns settlement close, normalized per-gram prices, "
        "and liquidity scores for all active gold contracts."
    ),
)
def get_contracts_by_date(
    date_str: str,
    db: Session = Depends(get_db),
) -> list[ContractDayItemResponse]:
    """Retrieve all contracts for a specific trade date."""
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid date format '{date_str}'. Expected YYYY-MM-DD.",
        ) from exc

    stmt = (
        select(
            BhavcopyRowRecord,
            NormalizedPriceRecord,
            LiquidityScoreRecord,
        )
        .outerjoin(
            NormalizedPriceRecord,
            (BhavcopyRowRecord.symbol == NormalizedPriceRecord.symbol)
            & (BhavcopyRowRecord.expiry_date == NormalizedPriceRecord.expiry_date)
            & (BhavcopyRowRecord.trade_date == NormalizedPriceRecord.trade_date),
        )
        .outerjoin(
            LiquidityScoreRecord,
            (BhavcopyRowRecord.symbol == LiquidityScoreRecord.symbol)
            & (BhavcopyRowRecord.expiry_date == LiquidityScoreRecord.expiry_date)
            & (BhavcopyRowRecord.trade_date == LiquidityScoreRecord.trade_date),
        )
        .where(BhavcopyRowRecord.trade_date == target_date)
        .order_by(BhavcopyRowRecord.symbol, BhavcopyRowRecord.expiry_date)
    )

    results = db.execute(stmt).all()

    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No contract data found for date {target_date.isoformat()}",
        )

    response_items: list[ContractDayItemResponse] = []
    for bhav, norm, liq in results:
        response_items.append(
            ContractDayItemResponse(
                symbol=bhav.symbol,
                expiry_date=bhav.expiry_date.isoformat(),
                trade_date=bhav.trade_date.isoformat(),
                close=bhav.close,
                price_per_gram=norm.price_per_gram if norm else None,
                fine_gold_price_per_gram=norm.fine_gold_price_per_gram if norm else None,
                volume=bhav.volume,
                open_interest=bhav.open_interest,
                volume_ratio=liq.volume_ratio if liq else None,
                oi_ratio=liq.oi_ratio if liq else None,
                days_to_expiry=liq.days_to_expiry
                if liq
                else (bhav.expiry_date - bhav.trade_date).days,
                history_days=liq.history_days if liq else None,
                label=liq.label if liq else None,
                reason=liq.reason if liq else None,
            )
        )

    return response_items
