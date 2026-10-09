"""Data Quality API routes."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.validate.scorecard import DataQualitySummaryResponse, build_scorecard

router = APIRouter(prefix="/data-quality", tags=["data-quality"])


@router.get(
    "/summary",
    response_model=DataQualitySummaryResponse,
    summary="Get Data Trust Scorecard summary",
    description=(
        "Returns aggregate file ingestion status, validation issues, anomalies, "
        "and contract coverage."
    ),
)
def get_data_quality_summary(
    date_from: date | None = Query(default=None, description="Start date for filtering metrics"),
    date_to: date | None = Query(default=None, description="End date for filtering metrics"),
    db: Session = Depends(get_db),
) -> DataQualitySummaryResponse:
    """Retrieve the Data Trust Scorecard."""
    return build_scorecard(session=db, date_from=date_from, date_to=date_to)
