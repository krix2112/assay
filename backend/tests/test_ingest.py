"""Comprehensive tests for MCX Bhavcopy ingestion using synthetic fixtures and mocks."""

import hashlib
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.core.config import settings
from app.ingest.archive import archive_raw_fetch
from app.ingest.fetcher import (
    LiveFetchDisabledError,
    RawFetch,
    fetch_bhavcopy,
)
from app.ingest.importer import import_bhavcopy_file
from app.ingest.parser import (
    BhavcopyRow,
    filter_gold_contracts,
    parse_bhavcopy,
)

BASE_FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures"
SYNTHETIC_DIR = BASE_FIXTURES_DIR / "synthetic"
REAL_NORMAL_FIXTURE = BASE_FIXTURES_DIR / "bhavcopy_normal_20261008.json"


def test_parser_synthetic_normal_day() -> None:
    """Parser must correctly parse the synthetic normal day fixture."""
    fixture_path = SYNTHETIC_DIR / "normal_day.json"
    raw_content = fixture_path.read_bytes()

    result = parse_bhavcopy(raw_content, requested_date=date(2026, 10, 8))

    assert len(result.rows) == 11
    assert len(result.errors) == 0
    assert result.requested_date == date(2026, 10, 8)
    assert result.trade_date == date(2026, 10, 8)

    # All four target gold symbols must be extractable
    gold_rows = filter_gold_contracts(result.rows)
    found_symbols = set(r.symbol for r in gold_rows)
    assert found_symbols == {"GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"}

    # Non-gold row (SILVER) must be excluded by filter
    assert len(gold_rows) == 10
    assert "SILVER" not in found_symbols

    # Type checks on first row
    first_row = result.rows[0]
    assert isinstance(first_row, BhavcopyRow)
    assert isinstance(first_row.open, Decimal)
    assert isinstance(first_row.high, Decimal)
    assert isinstance(first_row.low, Decimal)
    assert isinstance(first_row.close, Decimal)
    assert isinstance(first_row.volume, int)
    assert isinstance(first_row.open_interest, int)
    assert isinstance(first_row.trade_date, date)
    assert isinstance(first_row.expiry_date, date)


def test_parser_space_padded_symbols_cleaned() -> None:
    """Space-padded symbols must be stripped and uppercase."""
    fixture_path = SYNTHETIC_DIR / "normal_day.json"
    raw_content = fixture_path.read_bytes()

    result = parse_bhavcopy(raw_content)

    for row in result.rows:
        assert row.symbol == row.symbol.strip()
        assert row.symbol == row.symbol.upper()


def test_parser_synthetic_no_data_day() -> None:
    """A 'No data found' response must parse gracefully with 0 rows and 0 errors."""
    fixture_path = SYNTHETIC_DIR / "no_data_day.json"
    raw_content = fixture_path.read_bytes()

    result = parse_bhavcopy(raw_content, requested_date=date(2026, 10, 4))
    assert len(result.rows) == 0
    assert len(result.errors) == 0
    assert result.trade_date is None
    assert result.requested_date == date(2026, 10, 4)


def test_parser_synthetic_different_date_day() -> None:
    """Parser must preserve both requested_date and returned trade_date when they differ."""
    fixture_path = SYNTHETIC_DIR / "different_date_day.json"
    raw_content = fixture_path.read_bytes()

    requested = date(2026, 10, 4)  # Weekend request
    result = parse_bhavcopy(raw_content, requested_date=requested)

    assert result.requested_date == requested
    assert result.trade_date == date(2026, 10, 2)
    assert result.trade_date != result.requested_date
    assert len(result.rows) == 2
    assert len(result.errors) == 0


def test_parser_synthetic_malformed_rows() -> None:
    """Corrupted rows must be captured in ParseError objects without raising or dropping."""
    fixture_path = SYNTHETIC_DIR / "malformed_rows_day.json"
    raw_content = fixture_path.read_bytes()

    result = parse_bhavcopy(raw_content)

    # Exactly 1 valid row (GOLDPETAL) and 3 errors
    assert len(result.rows) == 1
    assert result.rows[0].symbol == "GOLDPETAL"
    assert len(result.errors) == 3

    reasons = [e.reason for e in result.errors]
    assert any("INVALID_DATE_FORMAT" in r for r in reasons)
    assert any("decimal" in r.lower() or "invalidoperation" in r.lower() for r in reasons)
    assert any("missing or invalid symbol" in r.lower() for r in reasons)


def test_parser_synthetic_duplicate_rows() -> None:
    """Parser preserves all received rows (including duplicates) for validation stage."""
    fixture_path = SYNTHETIC_DIR / "duplicate_rows_day.json"
    raw_content = fixture_path.read_bytes()

    result = parse_bhavcopy(raw_content)
    assert len(result.rows) == 3
    # Two identical GOLDM rows preserved in parse output
    goldm_rows = [r for r in result.rows if r.symbol == "GOLDM"]
    assert len(goldm_rows) == 2


def test_archive_never_overwrites_and_verifies_checksum(tmp_path: Path) -> None:
    """Archive service must store byte-for-byte and reject overwrites."""
    sample_content = b'{"synthetic": "payload"}'
    sha256_expected = hashlib.sha256(sample_content).hexdigest()

    fetch = RawFetch(
        requested_date=date(2026, 10, 8),
        content=sample_content,
        status_code=200,
        fetched_at=datetime(2026, 10, 8, 15, 30, 0, tzinfo=UTC),
        sha256=sha256_expected,
        url="file://synthetic",
    )

    raw_file, sidecar_file = archive_raw_fetch(fetch, storage_dir=tmp_path)

    assert raw_file.exists()
    assert sidecar_file.exists()
    assert raw_file.read_bytes() == sample_content

    with pytest.raises(FileExistsError):
        archive_raw_fetch(fetch, storage_dir=tmp_path)


def test_importer_service(tmp_path: Path) -> None:
    """Importer must read local file, archive to data/raw/ with sidecar, and parse rows."""
    fixture_path = SYNTHETIC_DIR / "normal_day.json"

    import_result = import_bhavcopy_file(
        fixture_path,
        requested_date=date(2026, 10, 8),
        storage_dir=tmp_path,
    )

    assert import_result.raw_path.exists()
    assert import_result.sidecar_path.exists()
    assert len(import_result.parse_result.rows) == 11

    # Check sidecar content
    sidecar_text = import_result.sidecar_path.read_text(encoding="utf-8")
    assert '"acquisition_method": "manual import"' in sidecar_text
    assert '"source_filename": "normal_day.json"' in sidecar_text


def test_fetcher_disabled_by_default() -> None:
    """fetch_bhavcopy must raise LiveFetchDisabledError when MCX_LIVE_FETCH_ENABLED is False."""
    with patch.object(settings, "MCX_LIVE_FETCH_ENABLED", False):
        with pytest.raises(LiveFetchDisabledError) as exc_info:
            fetch_bhavcopy(date(2026, 10, 8))

        assert "disabled by default" in str(exc_info.value)
        assert "prior written consent" in str(exc_info.value)


def test_fetcher_retries_on_5xx_and_does_not_retry_on_4xx_when_enabled() -> None:
    """When enabled, fetcher retries 3x on 5xx and halts immediately on 4xx."""
    req_date = date(2026, 10, 8)

    # Mock client for 5xx
    mock_client = MagicMock(spec=httpx.Client)
    resp_500 = MagicMock(spec=httpx.Response)
    resp_500.status_code = 500
    resp_500.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500 Internal Server Error",
        request=MagicMock(),
        response=resp_500,
    )
    mock_client.get.return_value = resp_500

    with patch.object(settings, "MCX_LIVE_FETCH_ENABLED", True):
        with patch("tenacity.nap.time.sleep"):
            with pytest.raises(httpx.HTTPStatusError) as exc_info:
                fetch_bhavcopy(req_date, client=mock_client)

            assert exc_info.value.response.status_code == 500
            assert mock_client.get.call_count == 3

    # Mock client for 4xx
    mock_client_4xx = MagicMock(spec=httpx.Client)
    resp_403 = MagicMock(spec=httpx.Response)
    resp_403.status_code = 403
    resp_403.raise_for_status.side_effect = httpx.HTTPStatusError(
        "403 Forbidden",
        request=MagicMock(),
        response=resp_403,
    )
    mock_client_4xx.get.return_value = resp_403

    with patch.object(settings, "MCX_LIVE_FETCH_ENABLED", True):
        with pytest.raises(httpx.HTTPStatusError) as exc_info_4xx:
            fetch_bhavcopy(req_date, client=mock_client_4xx)

        assert exc_info_4xx.value.response.status_code == 403
        assert mock_client_4xx.get.call_count == 1


@pytest.mark.skipif(
    not REAL_NORMAL_FIXTURE.exists(),
    reason="Real MCX fixture omitted from git repository (untracked/local only)",
)
def test_real_fixture_parses_if_present_locally() -> None:
    """Optional check verifying real fixture passes when available in local environment."""
    raw_content = REAL_NORMAL_FIXTURE.read_bytes()
    result = parse_bhavcopy(raw_content, requested_date=date(2026, 10, 8))
    assert len(result.rows) == 163
    gold_rows = filter_gold_contracts(result.rows)
    assert len(gold_rows) > 0
