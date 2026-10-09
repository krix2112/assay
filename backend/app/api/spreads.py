"""Spreads API endpoints (Stage S7)."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.spread import SpreadRecord

router = APIRouter(prefix="/spreads", tags=["spreads"])


class SpreadItemResponse(BaseModel):
    """Pair spread and rolling statistics response item."""

    model_config = ConfigDict(from_attributes=True)

    trade_date: date
    symbol_a: str
    expiry_a: date
    symbol_b: str
    expiry_b: date
    expiry_gap_days: int
    spread_bps: Decimal
    rolling_median_bps: Decimal | None
    rolling_mad_bps: Decimal | None
    robust_z: Decimal | None
    history_days: int
    weaker_liquidity_label: str
    method_version: str


@router.get(
    "",
    response_model=list[SpreadItemResponse],
    summary="Get pair spreads for a given trade date",
    description=(
        "Returns all contract pair spreads, rolling median/MAD, and robust z-scores for ?date=."
    ),
)
def get_spreads_by_date(
    target_date: date = Query(..., alias="date", description="Trade date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
) -> list[SpreadItemResponse]:
    """Retrieve all pair spreads for a specific date."""
    stmt = (
        select(SpreadRecord)
        .where(SpreadRecord.trade_date == target_date)
        .order_by(
            SpreadRecord.symbol_a,
            SpreadRecord.expiry_a,
            SpreadRecord.symbol_b,
            SpreadRecord.expiry_b,
        )
    )
    records = list(db.execute(stmt).scalars().all())

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No spreads found for date {target_date.isoformat()}",
        )

    return [SpreadItemResponse.model_validate(r) for r in records]
