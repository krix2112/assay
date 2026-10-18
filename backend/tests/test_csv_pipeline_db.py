"""Integration tests for CSV Bhavcopy import in isolated temporary schemas."""

import uuid
from datetime import date
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
from app.validate.models import CheckName

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
        conn.execute(text(f"CREATE SCHEMA {schema_name};"))
        conn.execute(text(f"SET search_path TO {schema_name};"))
        conn.commit()

        Base.metadata.create_all(conn)
        conn.commit()

        session = Session(bind=conn)
        for spec_dict in CONTRACT_SPECS_DATA:
            session.add(ContractSpec(**spec_dict))
        session.commit()

        yield session

        session.close()
    finally:
        try:
            conn.rollback()
            conn.execute(text("SET search_path TO public;"))
            conn.execute(text(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;"))
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()


def test_synthetic_csv_rules(temp_db_session: Session) -> None:
    """Verify all CSV pipeline rules on synthetic fixture:

    - OPTFUT GOLDM row ignored (out of scope)
    - blank-OHL row accepted with warning and nullable columns work
    - malformed row quarantined
    - space-padded symbol trimmed
    - re-import is a no-op
    """
    csv_file = SYNTHETIC_DIR / "synthetic_csv_day.csv"
    assert csv_file.is_file(), f"Fixture missing: {csv_file}"

    summary = process_file(
        csv_file,
        requested_date=date(2026, 10, 15),
        session=temp_db_session,
        allow_synthetic=True,
    )

    # Status and counts
    assert summary.status == "success"
    assert summary.rows_accepted == 2  # GOLDM and GOLDTEN
    assert summary.out_of_scope_count == 2  # OPTFUT GOLDM + SILVER
    assert summary.rows_quarantined == 1  # GOLDGUINEA with invalid expiry
    assert summary.warnings_count >= 1  # ZERO_VOLUME warning on GOLDTEN

    # 1. OPTFUT GOLDM row ignored:
    # Only 2 rows stored in DB (GOLDM FUTCOM and GOLDTEN FUTCOM)
    stored_rows = temp_db_session.scalars(select(BhavcopyRowRecord)).all()
    assert len(stored_rows) == 2
    symbols_stored = {r.symbol for r in stored_rows}
    assert symbols_stored == {"GOLDM", "GOLDTEN"}

    # 2. Space-padded symbol trimmed: "  GOLDM  " -> "GOLDM"
    goldm_row = temp_db_session.scalar(
        select(BhavcopyRowRecord).where(BhavcopyRowRecord.symbol == "GOLDM")
    )
    assert goldm_row is not None
    assert goldm_row.symbol == "GOLDM"
    assert goldm_row.open == Decimal("148500.0000")
    assert goldm_row.close == Decimal("148800.0000")

    # 3. Blank-OHL row accepted with warning & nullable columns work
    goldten_row = temp_db_session.scalar(
        select(BhavcopyRowRecord).where(BhavcopyRowRecord.symbol == "GOLDTEN")
    )
    assert goldten_row is not None
    assert goldten_row.open is None
    assert goldten_row.high is None
    assert goldten_row.low is None
    assert goldten_row.close == Decimal("148450.0000")
    assert goldten_row.volume == 0

    # Check ZERO_VOLUME warning was logged for GOLDTEN
    zv_log = temp_db_session.scalar(
        select(DataQualityLogRecord).where(
            DataQualityLogRecord.symbol == "GOLDTEN",
            DataQualityLogRecord.check_name == CheckName.ZERO_VOLUME,
        )
    )
    assert zv_log is not None

    # 4. Malformed row quarantined (GOLDGUINEA with invalid expiry)
    parse_err = temp_db_session.scalar(
        select(DataQualityLogRecord).where(DataQualityLogRecord.check_name == CheckName.PARSE_ERROR)
    )
    assert parse_err is not None
    assert "INVALID_EXPIRY" in str(parse_err.raw_row)

    # 5. Re-import is a no-op (idempotent skip on same file content)
    summary2 = process_file(
        csv_file,
        requested_date=date(2026, 10, 15),
        session=temp_db_session,
        allow_synthetic=True,
    )
    assert summary2.is_idempotent_skip is True
    assert summary2.rows_accepted == 0
    assert summary2.rows_quarantined == 0


def test_synthetic_csv_date_mismatch(temp_db_session: Session) -> None:
    """Filename / requested date differing from payload trade date gives DATE_MISMATCH."""
    csv_file = SYNTHETIC_DIR / "synthetic_csv_day.csv"

    # File trade date is 2026-10-15, but requested date is 2026-10-14
    summary = process_file(
        csv_file,
        requested_date=date(2026, 10, 14),
        session=temp_db_session,
        allow_synthetic=True,
    )

    assert summary.status == "date_mismatch"
    assert summary.requested_date == date(2026, 10, 14)
    assert summary.returned_trade_date == date(2026, 10, 15)

    rf = temp_db_session.scalar(
        select(RawFetchRecord).where(RawFetchRecord.sha256 == summary.sha256)
    )
    assert rf is not None
    assert rf.status == "date_mismatch"
    assert rf.acquisition_method == "manual download (MCX website CSV)"
