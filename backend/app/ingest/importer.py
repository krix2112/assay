"""Manual file import service for MCX Bhavcopy JSON payloads."""

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

from app.core.logging import logger
from app.ingest.archive import get_raw_storage_dir
from app.ingest.fetcher import RawFetch
from app.ingest.parser import BhavcopyParseResult, parse_bhavcopy


@dataclass(frozen=True)
class ImportResult:
    """Outcome of importing a local Bhavcopy file."""

    raw_fetch: RawFetch
    parse_result: BhavcopyParseResult
    raw_path: Path
    sidecar_path: Path

    def __iter__(self) -> Any:
        """Allow tuple unpacking as (raw_fetch, parse_result)."""
        yield self.raw_fetch
        yield self.parse_result


def _archive_imported_file(
    source_path: Path,
    content_bytes: bytes,
    sha256_hash: str,
    requested_date: date | None,
    trade_date: date | None,
    imported_at: datetime,
    storage_dir: Path | str | None = None,
) -> tuple[Path, Path]:
    """Archive imported file content and create 'manual import' sidecar."""
    dest_dir = get_raw_storage_dir(storage_dir)

    eff_date = requested_date or trade_date or imported_at.date()
    date_str = eff_date.strftime("%Y%m%d")
    timestamp_str = imported_at.strftime("%Y%m%dT%H%M%SZ")
    base_stem = f"bhavcopy_import_{date_str}_{timestamp_str}"

    raw_file = dest_dir / f"{base_stem}.json"
    sidecar_file = dest_dir / f"{base_stem}.meta.json"

    if raw_file.exists():
        raise FileExistsError(
            f"Archive file already exists and overwrite is prohibited: {raw_file}"
        )
    if sidecar_file.exists():
        raise FileExistsError(
            f"Archive sidecar already exists and overwrite is prohibited: {sidecar_file}"
        )

    # Save raw bytes byte-for-byte
    with open(raw_file, "wb") as f:
        f.write(content_bytes)

    sidecar_data = {
        "source_filename": source_path.name,
        "source_path": str(source_path.resolve()),
        "acquisition_method": "manual import",
        "imported_at": imported_at.isoformat(),
        "requested_date": requested_date.isoformat() if requested_date else None,
        "trade_date": trade_date.isoformat() if trade_date else None,
        "sha256": sha256_hash,
        "byte_length": len(content_bytes),
        "status_code": 200,
        "raw_filename": raw_file.name,
    }

    with open(sidecar_file, "w", encoding="utf-8") as f:
        json.dump(sidecar_data, f, indent=2)

    logger.info(
        "Archived manually imported Bhavcopy",
        source=source_path.name,
        archive_raw=str(raw_file),
        sha256=sha256_hash,
    )

    return raw_file, sidecar_file


def import_bhavcopy_file(
    file_path: Path | str,
    requested_date: date | None = None,
    storage_dir: Path | str | None = None,
) -> ImportResult:
    """Read a manually saved MCX Bhavcopy JSON file, archive it, and parse rows.

    Args:
        file_path: Path to local JSON file obtained from MCX website.
        requested_date: Optional requested calendar date.
        storage_dir: Optional override for raw archive directory.

    Returns:
        ImportResult containing raw_fetch, parse_result, raw_path, and sidecar_path.
    """
    path = Path(file_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Bhavcopy file not found: {path}")

    content_bytes = path.read_bytes()
    sha256_hash = hashlib.sha256(content_bytes).hexdigest()
    imported_at = datetime.now(UTC)

    # First parse to identify trade date and validate schema
    parse_outcome = parse_bhavcopy(content_bytes, requested_date=requested_date)
    discovered_date = parse_outcome.trade_date

    eff_requested_date = requested_date or discovered_date or imported_at.date()

    # Archive unchanged to data/raw/ BEFORE final returning
    raw_path, sidecar_path = _archive_imported_file(
        source_path=path,
        content_bytes=content_bytes,
        sha256_hash=sha256_hash,
        requested_date=requested_date,
        trade_date=discovered_date,
        imported_at=imported_at,
        storage_dir=storage_dir,
    )

    raw_fetch = RawFetch(
        requested_date=eff_requested_date,
        content=content_bytes,
        status_code=200,
        fetched_at=imported_at,
        sha256=sha256_hash,
        url=f"file://{path.as_posix()}",
    )

    return ImportResult(
        raw_fetch=raw_fetch,
        parse_result=parse_outcome,
        raw_path=raw_path,
        sidecar_path=sidecar_path,
    )
