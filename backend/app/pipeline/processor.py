"""Assay ingest and storage pipeline (Stages S1-S4).

Orchestrates import -> parse -> filter -> validate -> store in a single
idempotent database transaction.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.logging import logger
from app.ingest.importer import import_bhavcopy_file
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.data_quality import DataQualityLogRecord
from app.models.raw_fetch import RawFetchRecord
from app.validate.models import CheckName, Severity, ValidationReport
from app.validate.validator import _row_to_dict, validate_bhavcopy


@dataclass(frozen=True)
class PipelineSummary:
    """Summary of processing an MCX Bhavcopy file through the pipeline."""

    file_path: str
    sha256: str
    status: str
    rows_parsed: int
    rows_accepted: int
    rows_quarantined: int
    warnings_count: int
    out_of_scope_count: int
    is_idempotent_skip: bool = False
    requested_date: date | None = None
    returned_trade_date: date | None = None
    rows_new: int = 0
    rows_identical: int = 0
    conflicts: tuple[dict[str, Any], ...] = ()


def process_file(
    path: Path | str,
    requested_date: date | None = None,
    session: Session | None = None,
    allow_synthetic: bool = False,
) -> PipelineSummary:
    """Process an MCX Bhavcopy JSON file from disk into the database.

    Guarantees:
    - Idempotent: If a file with the same SHA-256 is already imported, do nothing.
    - Upsert: If a row exists with DIFFERENT values, keep existing row and log
      CONFLICTING_REVISION (error). Identical rows are a no-op.
    - DATE_MISMATCH: Stored under true returned trade date; status set to
      'date_mismatch'; rows are NOT quarantined.
    - "No data found": Stored as raw_fetches with status 'no_data', row_count=0, 0 errors.
    - Synthetic Guard: Refuses synthetic fixtures unless allow_synthetic=True.
    - All storage executed inside a single transaction.
    """
    file_path = Path(path).resolve()
    if not file_path.is_file():
        raise FileNotFoundError(f"File not found: {file_path}")

    # Synthetic data guard
    is_synthetic = (
        "data/fixtures/synthetic" in file_path.as_posix() or "synthetic" in file_path.parts
    )
    if is_synthetic and not allow_synthetic:
        msg = (
            f"REFUSED: File '{file_path.name}' is from synthetic fixtures. "
            "Synthetic data must never be loaded into a real database without "
            "explicit allow_synthetic=True."
        )
        logger.warning("Synthetic file rejected", path=str(file_path))
        raise ValueError(msg)

    content_bytes = file_path.read_bytes()
    sha256_hash = hashlib.sha256(content_bytes).hexdigest()

    def _execute(db: Session) -> PipelineSummary:
        # 1. Idempotency check: see if SHA-256 already recorded
        existing_fetch = db.scalar(
            select(RawFetchRecord).where(RawFetchRecord.sha256 == sha256_hash)
        )
        if existing_fetch is not None:
            logger.info(
                "Idempotent skip: file already imported",
                sha256=sha256_hash,
                raw_fetch_id=existing_fetch.id,
                status=existing_fetch.status,
            )
            return PipelineSummary(
                file_path=str(file_path),
                sha256=sha256_hash,
                status=existing_fetch.status,
                rows_parsed=existing_fetch.row_count,
                rows_accepted=0,
                rows_quarantined=0,
                warnings_count=0,
                out_of_scope_count=0,
                is_idempotent_skip=True,
                requested_date=existing_fetch.requested_date,
                returned_trade_date=existing_fetch.returned_trade_date,
            )

        # 2. Check for "No data found" payload before or during parse
        is_no_data = False
        try:
            payload_obj = json.loads(content_bytes)
            if isinstance(payload_obj, dict):
                msg = str(payload_obj.get("Message", "")).lower()
                data_val = payload_obj.get("Data")
                if "no data" in msg or (data_val is None and payload_obj.get("IsSuccess") is False):
                    is_no_data = True
        except Exception:
            pass

        # 3. Import and archive payload byte-for-byte
        import_res = import_bhavcopy_file(
            file_path=file_path,
            requested_date=requested_date,
        )
        parse_res = import_res.parse_result
        returned_trade_date = parse_res.trade_date

        if is_no_data:
            # Handle "No data found" day: store raw_fetches with status 'no_data' and 0 rows
            raw_fetch = RawFetchRecord(
                requested_date=requested_date,
                returned_trade_date=None,
                acquisition_method="manual download (MCX website CSV)",
                source_name=file_path.name,
                sha256=sha256_hash,
                archive_path=str(import_res.raw_path),
                imported_at=datetime.now(UTC),
                status="no_data",
                row_count=0,
            )
            db.add(raw_fetch)
            db.flush()

            logger.info("Imported 'No data found' exchange payload", sha256=sha256_hash)
            return PipelineSummary(
                file_path=str(file_path),
                sha256=sha256_hash,
                status="no_data",
                rows_parsed=0,
                rows_accepted=0,
                rows_quarantined=0,
                warnings_count=0,
                out_of_scope_count=0,
                is_idempotent_skip=False,
                requested_date=requested_date,
                returned_trade_date=None,
            )

        # 4. Pure validation (Stage S3)
        val_report: ValidationReport = validate_bhavcopy(
            parse_result=parse_res,
            requested_date=requested_date,
        )

        # Determine file status
        if val_report.has_date_mismatch:
            file_status = "date_mismatch"
        else:
            file_status = "success"

        # 5. Persist raw_fetches record
        raw_fetch = RawFetchRecord(
            requested_date=requested_date or parse_res.requested_date,
            returned_trade_date=returned_trade_date,
            acquisition_method="manual download (MCX website CSV)",
            source_name=file_path.name,
            sha256=sha256_hash,
            archive_path=str(import_res.raw_path),
            imported_at=datetime.now(UTC),
            status=file_status,
            row_count=len(parse_res.rows),
        )
        db.add(raw_fetch)
        db.flush()  # populate raw_fetch.id

        # 6. Store accepted rows and detect conflicting revisions
        accepted_count = 0
        new_count = 0
        identical_count = 0
        conflicts_count = 0
        conflicts_list: list[dict[str, Any]] = []
        now_utc = datetime.now(UTC)

        for row in val_report.accepted_rows:
            # Check existing row by PK: (symbol, expiry_date, trade_date)
            existing = db.get(
                BhavcopyRowRecord,
                (row.symbol, row.expiry_date, row.trade_date),
            )
            if existing is None:
                new_row = BhavcopyRowRecord(
                    symbol=row.symbol,
                    expiry_date=row.expiry_date,
                    trade_date=row.trade_date,
                    open=row.open,
                    high=row.high,
                    low=row.low,
                    close=row.close,
                    volume=row.volume,
                    open_interest=row.open_interest,
                    raw_fetch_id=raw_fetch.id,
                )
                db.add(new_row)
                accepted_count += 1
                new_count += 1
            else:
                # Compare fields for identical match vs conflicting revision
                is_identical = (
                    existing.open == row.open
                    and existing.high == row.high
                    and existing.low == row.low
                    and existing.close == row.close
                    and existing.volume == row.volume
                    and existing.open_interest == row.open_interest
                )
                if is_identical:
                    # Identical row is a no-op
                    accepted_count += 1
                    identical_count += 1
                else:
                    # Conflicting revision! Keep existing row and log CONFLICTING_REVISION error
                    conflicts_count += 1
                    conflict_item = {
                        "symbol": row.symbol,
                        "expiry_date": row.expiry_date,
                        "trade_date": row.trade_date,
                        "existing": {
                            "open": existing.open,
                            "high": existing.high,
                            "low": existing.low,
                            "close": existing.close,
                            "volume": existing.volume,
                            "open_interest": existing.open_interest,
                        },
                        "incoming": {
                            "open": row.open,
                            "high": row.high,
                            "low": row.low,
                            "close": row.close,
                            "volume": row.volume,
                            "open_interest": row.open_interest,
                        },
                    }
                    conflicts_list.append(conflict_item)
                    db.add(
                        DataQualityLogRecord(
                            raw_fetch_id=raw_fetch.id,
                            trade_date=row.trade_date,
                            symbol=row.symbol,
                            expiry_date=row.expiry_date,
                            check_name=CheckName.CONFLICTING_REVISION,
                            severity=Severity.ERROR,
                            reason=(
                                f"Conflicting revision for ({row.symbol}, "
                                f"{row.expiry_date}, {row.trade_date}): "
                                f"existing OHLC=({existing.open}/{existing.high}/"
                                f"{existing.low}/{existing.close}) vs incoming "
                                f"OHLC=({row.open}/{row.high}/{row.low}/{row.close})"
                            ),
                            raw_row={
                                "existing": {
                                    "open": str(existing.open),
                                    "high": str(existing.high),
                                    "low": str(existing.low),
                                    "close": str(existing.close),
                                    "volume": existing.volume,
                                    "open_interest": existing.open_interest,
                                    "raw_fetch_id": existing.raw_fetch_id,
                                },
                                "incoming": _row_to_dict(row),
                            },
                            created_at=now_utc,
                        )
                    )

        # 7. Persist all data quality issues (file issues, parse errors, quarantined rows, warnings)
        for issue in val_report.all_issues:
            db.add(
                DataQualityLogRecord(
                    raw_fetch_id=raw_fetch.id,
                    trade_date=issue.trade_date or returned_trade_date,
                    symbol=issue.symbol,
                    expiry_date=issue.expiry_date,
                    check_name=issue.check_name,
                    severity=issue.severity,
                    reason=issue.reason,
                    raw_row=issue.raw_row,
                    created_at=now_utc,
                )
            )

        warnings_count = sum(1 for i in val_report.all_issues if i.severity == Severity.WARNING)

        return PipelineSummary(
            file_path=str(file_path),
            sha256=sha256_hash,
            status=file_status,
            rows_parsed=len(parse_res.rows),
            rows_accepted=accepted_count,
            rows_quarantined=val_report.total_quarantined + conflicts_count,
            warnings_count=warnings_count,
            out_of_scope_count=val_report.out_of_scope_count,
            is_idempotent_skip=False,
            requested_date=requested_date,
            returned_trade_date=returned_trade_date,
            rows_new=new_count,
            rows_identical=identical_count,
            conflicts=tuple(conflicts_list),
        )

    if session is not None:
        # Caller manages session lifecycle, but execute store in transaction
        return _execute(session)
    else:
        with SessionLocal() as db:
            with db.begin():
                return _execute(db)
