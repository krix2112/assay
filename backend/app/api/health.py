"""Health check API routes."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import check_database_connection

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    """Health status response payload."""

    status: Literal["ok"]
    environment: str
    database: Literal["up", "down"]


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Return application health status and database connectivity."""
    db_up = check_database_connection()
    return HealthResponse(
        status="ok",
        environment=settings.ENVIRONMENT,
        database="up" if db_up else "down",
    )
