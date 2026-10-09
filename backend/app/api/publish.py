"""FastAPI endpoints for track record inspection and verification."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.track_record import TrackRecordEntry
from app.publish.chain import verify_chain

router = APIRouter(prefix="/track-record", tags=["track-record"])


@router.get("")
def get_track_record(
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve immutable track record entries in id order."""
    entries = db.scalars(
        select(TrackRecordEntry).order_by(TrackRecordEntry.id.asc()).limit(limit)
    ).all()
    return [
        {
            "id": e.id,
            "trade_date": e.trade_date.isoformat(),
            "revision": e.revision,
            "record": e.record,
            "canonical_json": e.canonical_json,
            "prev_hash": e.prev_hash,
            "hash": e.hash,
            "created_at": e.created_at.isoformat(),
        }
        for e in entries
    ]


@router.get("/verify")
def get_track_record_verify(
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Verify hash chain integrity from genesis to latest entry."""
    return verify_chain(db)
