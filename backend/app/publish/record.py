"""Pure function to construct derived track record content."""

import subprocess
from datetime import date
from decimal import Decimal
from typing import Any

FORBIDDEN_PRICE_KEYS = frozenset(
    {
        "open",
        "high",
        "low",
        "close",
        "volume",
        "open_interest",
        "settlement_price",
        "previous_close",
        "fine_gold_price_per_gram",
    }
)


def get_git_commit_hash() -> str:
    """Retrieve git HEAD commit hash or 'unknown' on error/absence."""
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            timeout=3,
        )
        commit = res.stdout.strip()
        return commit if commit else "unknown"
    except Exception:
        return "unknown"


def assert_no_raw_prices(obj: Any, parent_key: str = "") -> None:
    """Recursively verify no raw price or volume attributes exist in obj."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            k_lower = str(k).lower()
            if (
                parent_key not in ("liquidity_counts", "liquidity_label_counts")
                and k_lower in FORBIDDEN_PRICE_KEYS
            ):
                raise ValueError(f"Forbidden raw market attribute '{k}' found in track record")
            assert_no_raw_prices(v, parent_key=str(k))
    elif isinstance(obj, list | tuple | set):
        for item in obj:
            assert_no_raw_prices(item, parent_key=parent_key)


def build_record(trade_date: date, data: dict[str, Any]) -> dict[str, Any]:
    """Build canonical derived track record dictionary for trade_date.

    Explicitly excludes all raw MCX price, volume, and open interest fields.
    """
    assert_no_raw_prices(data)

    parity = data.get("parity") or {}
    score = parity.get("score")
    if isinstance(score, Decimal):
        score_str: str | None = str(score)
    elif score is not None:
        score_str = str(score)
    else:
        score_str = None

    record = {
        "trade_date": trade_date.isoformat(),
        "parity": {
            "score": score_str,
            "status": parity.get("status"),
            "pairs_used": int(parity.get("pairs_used", 0)),
            "pairs_excluded": int(parity.get("pairs_excluded", 0)),
        },
        "liquidity_label_counts": {
            str(k): int(v) for k, v in data.get("liquidity_counts", {}).items()
        },
        "data_quality_counts": {str(k): int(v) for k, v in data.get("quality_counts", {}).items()},
        "files_imported_by_status": {
            str(k): int(v) for k, v in data.get("import_counts", {}).items()
        },
        "method_versions": {
            str(k): str(v)
            for k, v in data.get(
                "method_versions",
                {
                    "parity": "v1",
                    "liquidity": "v1",
                    "spreads": "v1",
                    "normalize": "v1",
                },
            ).items()
        },
        "code_version": data.get("code_version") or get_git_commit_hash(),
        "latest_backtest_verdict": data.get("latest_backtest_verdict"),
    }

    assert_no_raw_prices(record)
    return record
