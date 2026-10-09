#!/usr/bin/env python3
"""CLI utility to export track record entries to data/track_record/."""

from pathlib import Path

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.track_record import TrackRecordEntry

EXPORT_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "track_record"


def export_records() -> int:
    """Write each track record entry to a JSON file in data/track_record/."""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    session = SessionLocal()
    try:
        entries = session.scalars(
            select(TrackRecordEntry).order_by(TrackRecordEntry.id.asc())
        ).all()
        for e in entries:
            filename = f"track_record_{e.trade_date.isoformat()}_rev{e.revision}.json"
            filepath = EXPORT_DIR / filename
            filepath.write_text(e.canonical_json, encoding="utf-8")
        return len(entries)
    finally:
        session.close()


def main() -> None:
    count = export_records()
    print(f"Exported {count} track record entries to {EXPORT_DIR}")


if __name__ == "__main__":
    main()
