"""Raw fetch archiving service with immutable writes and metadata sidecars."""

import json
from datetime import UTC
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger
from app.ingest.fetcher import RawFetch


def get_raw_storage_dir(base_dir: Path | str | None = None) -> Path:
    """Resolve directory path where raw files are archived."""
    if base_dir is not None:
        raw_dir = Path(base_dir)
    else:
        # Check if running within backend/ or workspace root
        candidate = Path(settings.RAW_DATA_DIR)
        if not candidate.is_absolute():
            # If backend folder, step up to workspace root if data/ is there
            if Path("../data").exists():
                candidate = Path("../data/raw")
            elif Path("data").exists():
                candidate = Path("data/raw")
        raw_dir = candidate

    raw_dir.mkdir(parents=True, exist_ok=True)
    return raw_dir


def archive_raw_fetch(
    fetch: RawFetch,
    storage_dir: Path | str | None = None,
) -> tuple[Path, Path]:
    """Save RawFetch payload and sidecar metadata to disk.

    Guarantees:
    - Never overwrites an existing file (raises FileExistsError).
    - Writes raw content byte-for-byte.
    - Writes an accompanying .meta.json sidecar file.

    Returns:
        tuple[Path, Path]: (raw_content_file_path, sidecar_file_path)
    """
    dest_dir = get_raw_storage_dir(storage_dir)

    # Format date and fetched_at timestamp for filename
    date_str = fetch.requested_date.strftime("%Y%m%d")
    timestamp_str = fetch.fetched_at.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
    base_stem = f"bhavcopy_{date_str}_{timestamp_str}"

    raw_file = dest_dir / f"{base_stem}.json"
    sidecar_file = dest_dir / f"{base_stem}.meta.json"

    # Enforce no overwrite
    if raw_file.exists():
        raise FileExistsError(
            f"Archive raw file already exists and overwrite is prohibited: {raw_file}"
        )
    if sidecar_file.exists():
        raise FileExistsError(
            f"Archive sidecar file already exists and overwrite is prohibited: {sidecar_file}"
        )

    # Save raw bytes byte-for-byte
    with open(raw_file, "wb") as f:
        f.write(fetch.content)

    # Prepare sidecar metadata
    sidecar_data = {
        "requested_date": fetch.requested_date.isoformat(),
        "fetched_at": fetch.fetched_at.isoformat(),
        "status_code": fetch.status_code,
        "sha256": fetch.sha256,
        "byte_length": len(fetch.content),
        "url": fetch.url,
        "raw_filename": raw_file.name,
    }

    with open(sidecar_file, "w", encoding="utf-8") as f:
        json.dump(sidecar_data, f, indent=2)

    logger.info(
        "Archived raw Bhavcopy fetch",
        raw_file=str(raw_file),
        sidecar_file=str(sidecar_file),
        sha256=fetch.sha256,
    )

    return raw_file, sidecar_file
