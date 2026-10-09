"""Database pipeline integration tests in isolated temporary schemas."""

import json
import uuid
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.database import Base, check_database_connection, engine
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.contract_spec import ContractSpec
from app.models.data_quality import DataQualityLogRecord
from app.models.raw_fetch import RawFetchRecord
from app.pipeline.processor import process_file
from app.validate.models import CheckName, Severity
from app.validate.scorecard import build_scorecard

CONTRACT_SPECS_DATA = [
    {
        "symbol": "GOLDM",
        "trading_unit_grams": Decimal("100"),
        "quote_unit_grams": Decimal("10"),
        "purity": Decimal("0.995"),
        "expiry_window_start_day": 3,
        "expiry_window_end_day": 5,
        "source_note": "from challenge brief, verify against MCX specification",
    },
    {
        "symbol": "GOLDTEN",
        "trading_unit_grams": Decimal("10"),
        "quote_unit_grams": Decimal("10"),
        "purity": Decimal("0.999"),
        "expiry_window_start_day": 27,
        "expiry_window_end_day": 31,
        "source_note": "from challenge brief, verify against MCX specification",
    },
    {
        "symbol": "GOLDGUINEA",
        "trading_unit_grams": Decimal("8"),
        "quote_unit_grams": Decimal("8"),
        "purity": Decimal("0.999"),
        "expiry_window_start_day": 27,
        "expiry_window_end_day": 31,
        "source_note": "from challenge brief, verify against MCX specification",
    },
    {
        "symbol": "GOLDPETAL",
        "trading_unit_grams": Decimal("1"),
        "quote_unit_grams": Decimal("1"),
        "purity": Decimal("0.999"),
        "expiry_window_start_day": 27,
        "expiry_window_end_day": 31,
        "source_note": "from challenge brief, verify against MCX specification",
    },
]

SYNTHETIC_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "synthetic"


@pytest.fixture
def temp_db_session():
    """Create a temporary schema with a random name, create tables, and drop afterwards."""
    if not check_database_connection():
        pytest.skip("Database is unreachable; skipping database integration tests")

    schema_name = f"test_schema_{uuid.uuid4().hex[:12]}"
    conn = engine.connect()

    try:
        # Create temporary isolated schema
        conn.execute(text(f"CREATE SCHEMA {schema_name};"))
        conn.execute(text(f"SET search_path TO {schema_name};"))
        conn.commit()

        # Create all tables inside the isolated schema
        Base.metadata.create_all(conn)
        conn.commit()

        # Seed contract_specs inside isolated schema
        session = Session(bind=conn)
        for spec_dict in CONTRACT_SPECS_DATA:
            session.add(ContractSpec(**spec_dict))
        session.commit()

        yield session

        session.close()
    finally:
        # Teardown: switch back search path and drop the temporary schema
        try:
            conn.rollback()
            conn.execute(text("SET search_path TO public;"))
            conn.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;"))
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()


def test_synthetic_guard_refuses_without_flag(temp_db_session: Session) -> None:
    """process_file must refuse synthetic fixtures unless allow_synthetic=True."""
    normal_file = SYNTHETIC_DIR / "normal_day.json"
    with pytest.raises(ValueError, match="REFUSED"):
        process_file(normal_file, session=temp_db_session, allow_synthetic=False)


def test_idempotent_import_and_normal_file(temp_db_session: Session) -> None:
    """Processing a file once stores rows; processing a second time is an idempotent skip."""
    normal_file = SYNTHETIC_DIR / "normal_day.json"

    # First run: processes file and stores accepted rows
    summary1 = process_file(normal_file, session=temp_db_session, allow_synthetic=True)
    assert not summary1.is_idempotent_skip
    assert summary1.status == "success"
    assert summary1.rows_accepted == 10
    assert summary1.rows_quarantined == 0

    # Second run: identical file, must be an idempotent skip
    summary2 = process_file(normal_file, session=temp_db_session, allow_synthetic=True)
    assert summary2.is_idempotent_skip
    assert summary2.rows_accepted == 0

    # Verify database contents remained identical
    fetch_count = temp_db_session.scalar(select(text("count(*)")).select_from(RawFetchRecord))
    row_count = temp_db_session.scalar(select(text("count(*)")).select_from(BhavcopyRowRecord))
    assert fetch_count == 1
    assert row_count == 10


def test_conflicting_revision_keeps_old_row(temp_db_session: Session, tmp_path: Path) -> None:
    """When a file has different prices for existing key, keep existing and log conflict."""
    normal_file = SYNTHETIC_DIR / "normal_day.json"
    process_file(normal_file, session=temp_db_session, allow_synthetic=True)

    # Create a modified copy with a different price for the same contract key
    data = json.loads(normal_file.read_text(encoding="utf-8"))
    # Modify Close of first item with consistent OHLC
    data["Data"][0]["High"] = 149650.0
    data["Data"][0]["Close"] = 149600.0
    revised_file = tmp_path / "revised_normal_day.json"
    revised_file.write_text(json.dumps(data), encoding="utf-8")

    summary = process_file(revised_file, session=temp_db_session, allow_synthetic=True)
    assert summary.rows_quarantined >= 1

    # Verify existing row close price was NOT overwritten
    existing_row = temp_db_session.scalar(
        select(BhavcopyRowRecord).where(
            BhavcopyRowRecord.symbol == "GOLDM",
            BhavcopyRowRecord.trade_date == text("'2026-10-08'"),
        )
    )
    assert existing_row is not None
    assert existing_row.close != 149600.0

    # Verify CONFLICTING_REVISION was logged in data_quality_log
    conflict_log = temp_db_session.scalar(
        select(DataQualityLogRecord).where(
            DataQualityLogRecord.check_name == CheckName.CONFLICTING_REVISION
        )
    )
    assert conflict_log is not None
    assert conflict_log.severity == Severity.ERROR
    assert isinstance(conflict_log.raw_row, dict)
    assert "existing" in conflict_log.raw_row
    assert "incoming" in conflict_log.raw_row


def test_date_mismatch_handling(temp_db_session: Session) -> None:
    """Date mismatch sets 'date_mismatch' status, stores under true date, no quarantine."""
    diff_file = SYNTHETIC_DIR / "different_date_day.json"
    from datetime import date

    # Request Oct 7, but payload returns Oct 2
    summary = process_file(
        diff_file,
        requested_date=date(2026, 10, 7),
        session=temp_db_session,
        allow_synthetic=True,
    )
    assert summary.status == "date_mismatch"
    assert summary.rows_accepted == 2
    assert summary.rows_quarantined == 0

    # Check raw_fetches record status
    rf = temp_db_session.scalar(
        select(RawFetchRecord).where(RawFetchRecord.sha256 == summary.sha256)
    )
    assert rf is not None
    assert rf.status == "date_mismatch"
    assert rf.requested_date == date(2026, 10, 7)
    assert rf.returned_trade_date == date(2026, 10, 2)

    # Check rows are stored under Oct 2
    rows = temp_db_session.scalars(
        select(BhavcopyRowRecord).where(BhavcopyRowRecord.trade_date == date(2026, 10, 2))
    ).all()
    assert len(rows) >= 2


def test_no_data_day_handling(temp_db_session: Session) -> None:
    """No data day stores raw_fetches with status 'no_data' and 0 rows without errors."""
    no_data_file = SYNTHETIC_DIR / "no_data_day.json"
    summary = process_file(no_data_file, session=temp_db_session, allow_synthetic=True)

    assert summary.status == "no_data"
    assert summary.rows_parsed == 0
    assert summary.rows_accepted == 0
    assert summary.rows_quarantined == 0

    # Verify in DB
    rf = temp_db_session.scalar(
        select(RawFetchRecord).where(RawFetchRecord.sha256 == summary.sha256)
    )
    assert rf is not None
    assert rf.status == "no_data"
    assert rf.row_count == 0


def test_duplicate_rows_quarantined(temp_db_session: Session) -> None:
    """Duplicate contract rows in one file must all be quarantined."""
    dup_file = SYNTHETIC_DIR / "duplicate_rows_day.json"
    summary = process_file(dup_file, session=temp_db_session, allow_synthetic=True)

    assert summary.rows_accepted == 1
    assert summary.rows_quarantined == 2

    # Verify duplicate issues in log
    dup_logs = temp_db_session.scalars(
        select(DataQualityLogRecord).where(
            DataQualityLogRecord.check_name == CheckName.DUPLICATE_ROW
        )
    ).all()
    assert len(dup_logs) == 2


def test_malformed_rows_quarantined(temp_db_session: Session) -> None:
    """Malformed rows must be logged and quarantined while valid rows are stored."""
    malformed_file = SYNTHETIC_DIR / "malformed_rows_day.json"
    summary = process_file(malformed_file, session=temp_db_session, allow_synthetic=True)

    assert summary.rows_accepted == 1
    assert summary.rows_quarantined == 3

    parse_logs = temp_db_session.scalars(
        select(DataQualityLogRecord).where(DataQualityLogRecord.check_name == CheckName.PARSE_ERROR)
    ).all()
    assert len(parse_logs) == 3


def test_warning_rows_still_stored(temp_db_session: Session, tmp_path: Path) -> None:
    """Rows with only warnings (e.g. ZERO_VOLUME) must still be stored in bhavcopy_rows."""
    normal_file = SYNTHETIC_DIR / "normal_day.json"
    data = json.loads(normal_file.read_text(encoding="utf-8"))
    # Set Volume to 0 for first row
    data["Data"][0]["Volume"] = 0
    warn_file = tmp_path / "warning_zero_vol.json"
    warn_file.write_text(json.dumps(data), encoding="utf-8")

    summary = process_file(warn_file, session=temp_db_session, allow_synthetic=True)
    assert summary.rows_accepted == 10
    assert summary.warnings_count >= 1

    zero_vol_log = temp_db_session.scalar(
        select(DataQualityLogRecord).where(DataQualityLogRecord.check_name == CheckName.ZERO_VOLUME)
    )
    assert zero_vol_log is not None
    assert zero_vol_log.severity == Severity.WARNING


def test_scorecard_counts_match_database(temp_db_session: Session) -> None:
    """Data trust scorecard accurately aggregates stored and quarantined records."""
    normal_file = SYNTHETIC_DIR / "normal_day.json"
    process_file(normal_file, session=temp_db_session, allow_synthetic=True)

    scorecard = build_scorecard(temp_db_session)
    assert scorecard.rows_accepted == 10
    assert scorecard.rows_quarantined == 0
    assert "success" in scorecard.files_by_status
    assert len(scorecard.contract_coverage) == 4
