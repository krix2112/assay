"""Hash-chained immutable track record management."""

import hashlib
import json
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.backtest import BacktestRunRecord
from app.models.data_quality import DataQualityLogRecord
from app.models.liquidity import LiquidityScoreRecord
from app.models.parity import ParityScoreRecord
from app.models.raw_fetch import RawFetchRecord
from app.models.track_record import TrackRecordEntry
from app.publish.record import build_record


def json_canonical_default(o: Any) -> str:
    """Serialize dates, datetimes, Decimals to strings for canonical JSON."""
    if isinstance(o, date | datetime):
        return o.isoformat()
    if isinstance(o, Decimal):
        return str(o)
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")


def to_canonical_json(obj: Any) -> str:
    """Format object as deterministic, sorted-key, compact canonical JSON."""
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        default=json_canonical_default,
        ensure_ascii=False,
    )


def compute_hash(canonical_json: str, prev_hash: str | None) -> str:
    """Compute SHA-256 hex digest of canonical_json + prev_hash."""
    payload = canonical_json + (prev_hash or "")
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def collect_daily_metrics(session: Session, trade_date: date) -> dict[str, Any]:
    """Gather derived summary statistics for trade_date from the database."""
    parity_row = session.scalars(
        select(ParityScoreRecord).where(ParityScoreRecord.trade_date == trade_date)
    ).first()

    parity_data: dict[str, Any] = {}
    if parity_row:
        excluded = (
            parity_row.details.get("pairs_excluded", 0)
            if isinstance(parity_row.details, dict)
            else 0
        )
        parity_data = {
            "score": parity_row.score,
            "status": parity_row.status,
            "pairs_used": parity_row.pairs_used,
            "pairs_excluded": excluded,
        }

    liquidity_counts_raw = session.execute(
        select(
            LiquidityScoreRecord.label,
            func.count(LiquidityScoreRecord.symbol),
        )
        .where(LiquidityScoreRecord.trade_date == trade_date)
        .group_by(LiquidityScoreRecord.label)
    ).all()
    liquidity_counts = {str(lbl): int(cnt) for lbl, cnt in liquidity_counts_raw}

    quality_counts_raw = session.execute(
        select(
            DataQualityLogRecord.check_name,
            func.count(DataQualityLogRecord.id),
        )
        .where(DataQualityLogRecord.trade_date == trade_date)
        .group_by(DataQualityLogRecord.check_name)
    ).all()
    quality_counts = {str(name): int(cnt) for name, cnt in quality_counts_raw}

    import_counts_raw = session.execute(
        select(
            RawFetchRecord.status,
            func.count(RawFetchRecord.id),
        )
        .where(RawFetchRecord.returned_trade_date == trade_date)
        .group_by(RawFetchRecord.status)
    ).all()
    import_counts = {str(st): int(cnt) for st, cnt in import_counts_raw}

    latest_backtest = session.scalars(
        select(BacktestRunRecord).order_by(desc(BacktestRunRecord.created_at))
    ).first()
    latest_verdict: str | None = None
    if latest_backtest and latest_backtest.summary:
        latest_verdict = latest_backtest.summary.get("verdict")

    return {
        "parity": parity_data,
        "liquidity_counts": liquidity_counts,
        "quality_counts": quality_counts,
        "import_counts": import_counts,
        "latest_backtest_verdict": latest_verdict,
    }


def append_record(
    session: Session,
    trade_date: date,
    data: dict[str, Any] | None = None,
) -> TrackRecordEntry | None:
    """Compute and append a new track record entry or revision.

    If an entry with identical canonical_json already exists for trade_date, does nothing.
    If values differ, appends a new revision with prev_hash linked to highest id in table.
    """
    if data is None:
        data = collect_daily_metrics(session, trade_date)

    record = build_record(trade_date, data)
    canonical = to_canonical_json(record)

    # Check latest revision for trade_date
    latest_for_date = session.scalars(
        select(TrackRecordEntry)
        .where(TrackRecordEntry.trade_date == trade_date)
        .order_by(desc(TrackRecordEntry.revision))
    ).first()

    if latest_for_date is not None:
        if latest_for_date.canonical_json == canonical:
            # Identical content: idempotent no-op
            return None
        new_revision = latest_for_date.revision + 1
    else:
        new_revision = 1

    # Chain order is strictly by id (insertion order):
    # prev_hash is the hash of the entry with the highest id overall.
    highest_id_entry = session.scalars(
        select(TrackRecordEntry).order_by(desc(TrackRecordEntry.id))
    ).first()
    prev_hash = highest_id_entry.hash if highest_id_entry else None
    current_hash = compute_hash(canonical, prev_hash)

    entry = TrackRecordEntry(
        trade_date=trade_date,
        revision=new_revision,
        record=record,
        canonical_json=canonical,
        prev_hash=prev_hash,
        hash=current_hash,
        created_at=datetime.now(UTC),
    )
    session.add(entry)
    session.flush()
    return entry


def verify_chain(session: Session) -> dict[str, Any]:
    """Verify integrity of the entire track record chain walking strictly by id."""
    entries = session.scalars(select(TrackRecordEntry).order_by(TrackRecordEntry.id.asc())).all()

    if not entries:
        return {"ok": True, "entries": 0, "first_broken": None}

    prev_hash: str | None = None
    for idx, entry in enumerate(entries):
        # 1. Verify link to previous entry's hash
        if entry.prev_hash != prev_hash:
            return {"ok": False, "entries": len(entries), "first_broken": idx}

        # 2. Verify canonical serialization matches stored record
        recomputed_canonical = to_canonical_json(entry.record)
        if recomputed_canonical != entry.canonical_json:
            return {"ok": False, "entries": len(entries), "first_broken": idx}

        # 3. Verify SHA-256 hash matches
        recomputed_hash = compute_hash(entry.canonical_json, entry.prev_hash)
        if recomputed_hash != entry.hash:
            return {"ok": False, "entries": len(entries), "first_broken": idx}

        prev_hash = entry.hash

    return {"ok": True, "entries": len(entries), "first_broken": None}
