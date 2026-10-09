"""Parity score API endpoints (Stage S8)."""

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.parity import ParityScoreRecord

router = APIRouter(prefix="/parity", tags=["parity"])


class ParityResponse(BaseModel):
    """Daily parity score response model."""

    model_config = ConfigDict(from_attributes=True)

    trade_date: date
    score: int | None
    status: str
    pairs_used: int
    explanation: str
    details: dict[str, Any]
    method_version: str
    computed_at: datetime
    is_draft: bool = True
    unvalidated: bool = True
    draft_notice: str = (
        "Parity Score v1 is a draft. It has NOT been validated against known dislocations."
    )


@router.get(
    "/latest",
    response_model=ParityResponse,
    summary="Get the most recent parity score",
    description="Returns the latest computed parity score across all MCX gold contracts.",
)
def get_latest_parity(
    db: Session = Depends(get_db),
) -> ParityResponse:
    """Retrieve the latest parity score."""
    stmt = select(ParityScoreRecord).order_by(ParityScoreRecord.trade_date.desc()).limit(1)
    record = db.execute(stmt).scalar_one_or_none()

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No parity scores found",
        )

    return ParityResponse(
        trade_date=record.trade_date,
        score=record.score,
        status=record.status,
        pairs_used=record.pairs_used,
        explanation=record.explanation,
        details=record.details,
        method_version=record.method_version,
        computed_at=record.computed_at,
        is_draft=True,
        unvalidated=True,
    )


@router.get(
    "/history",
    response_model=list[ParityResponse],
    summary="Get parity score history",
    description="Returns parity scores for a date range specified by ?from=&to=.",
)
def get_parity_history(
    from_date: date | None = Query(None, alias="from", description="Start date (inclusive)"),
    to_date: date | None = Query(None, alias="to", description="End date (inclusive)"),
    db: Session = Depends(get_db),
) -> list[ParityResponse]:
    """Retrieve parity scores over a date range."""
    stmt = select(ParityScoreRecord)
    if from_date is not None:
        stmt = stmt.where(ParityScoreRecord.trade_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(ParityScoreRecord.trade_date <= to_date)

    stmt = stmt.order_by(ParityScoreRecord.trade_date.asc())
    records = list(db.execute(stmt).scalars().all())

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No parity scores found for the requested period",
        )

    return [
        ParityResponse(
            trade_date=r.trade_date,
            score=r.score,
            status=r.status,
            pairs_used=r.pairs_used,
            explanation=r.explanation,
            details=r.details,
            method_version=r.method_version,
            computed_at=r.computed_at,
            is_draft=True,
            unvalidated=True,
        )
        for r in records
    ]
