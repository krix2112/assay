"""Database integration tests for S7 (spreads) and S8 (parity) in isolated temporary schemas."""

import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.analytics.parity import compute_parity
from app.analytics.spreads import compute_spreads
from app.core.database import Base, check_database_connection, engine, get_db
from app.liquidity.service import compute_liquidity
from app.main import app
from app.models.contract_spec import ContractSpec
from app.models.parity import ParityScoreRecord
from app.models.spread import SpreadRecord
from app.normalize.service import compute_normalized
from app.pipeline.processor import process_file

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
def temp_analytics_session():
    """Create a temporary schema with a random name, create tables, and drop afterwards."""
    if not check_database_connection():
        pytest.skip("Database is unreachable; skipping database integration tests")

    schema_name = f"test_analytics_{uuid.uuid4().hex[:12]}"
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


def test_spreads_and_parity_idempotent_db(temp_analytics_session: Session) -> None:
    """Test full pipeline execution from Bhavcopy through S7 and S8 with idempotency."""
    # 1. Ingest normal day synthetic data (with allow_synthetic=True)
    normal_file = SYNTHETIC_DIR / "normal_day.json"
    process_file(normal_file, session=temp_analytics_session, allow_synthetic=True)
    temp_analytics_session.commit()

    # 2. Run normalization (S5) and liquidity (S6)
    compute_normalized(temp_analytics_session)
    compute_liquidity(temp_analytics_session)
    temp_analytics_session.commit()

    trade_date = date(2026, 10, 8)

    # 3. Compute S7 spreads
    spreads_1 = compute_spreads(temp_analytics_session, trade_date)
    assert len(spreads_1) > 0
    temp_analytics_session.commit()

    # Recompute S7 spreads (Idempotency test)
    spreads_2 = compute_spreads(temp_analytics_session, trade_date)
    assert len(spreads_2) == len(spreads_1)
    temp_analytics_session.commit()

    # Verify rows in spreads table
    db_spreads = temp_analytics_session.scalars(
        select(SpreadRecord).where(SpreadRecord.trade_date == trade_date)
    ).all()
    assert len(db_spreads) == len(spreads_1)
    for s in db_spreads:
        assert s.expiry_gap_days <= 10
        assert s.spread_bps is not None
        assert s.method_version == "v1"

    # 4. Compute S8 parity score
    parity_1 = compute_parity(temp_analytics_session, trade_date)
    assert parity_1.trade_date == trade_date
    temp_analytics_session.commit()

    # Recompute S8 parity (Idempotency test)
    parity_2 = compute_parity(temp_analytics_session, trade_date)
    assert parity_2.trade_date == trade_date
    temp_analytics_session.commit()

    db_parities = temp_analytics_session.scalars(
        select(ParityScoreRecord).where(ParityScoreRecord.trade_date == trade_date)
    ).all()
    assert len(db_parities) == 1
    assert db_parities[0].trade_date == trade_date
    assert db_parities[0].status in ("ok", "insufficient_data")
    assert db_parities[0].method_version == "v1"


def test_api_endpoints_parity_and_spreads(temp_analytics_session: Session) -> None:
    """Test GET /parity/latest, GET /parity/history, and GET /spreads?date= endpoints."""
    # Seed data
    normal_file = SYNTHETIC_DIR / "normal_day.json"
    process_file(normal_file, session=temp_analytics_session, allow_synthetic=True)
    compute_normalized(temp_analytics_session)
    compute_liquidity(temp_analytics_session)
    trade_date = date(2026, 10, 8)
    compute_spreads(temp_analytics_session, trade_date)
    compute_parity(temp_analytics_session, trade_date)
    temp_analytics_session.commit()

    def override_get_db():
        yield temp_analytics_session

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # 1. GET /parity/latest
        resp = client.get("/parity/latest")
        assert resp.status_code == 200
        data = resp.json()
        assert data["trade_date"] == "2026-10-08"
        assert data["method_version"] == "v1"
        assert data["is_draft"] is True
        assert data["unvalidated"] is True
        assert "explanation" in data

        # 2. GET /parity/history
        resp_hist = client.get("/parity/history?from=2026-10-01&to=2026-10-10")
        assert resp_hist.status_code == 200
        hist_data = resp_hist.json()
        assert len(hist_data) == 1
        assert hist_data[0]["trade_date"] == "2026-10-08"

        # 3. GET /spreads?date=2026-10-08
        resp_spreads = client.get("/spreads?date=2026-10-08")
        assert resp_spreads.status_code == 200
        spreads_data = resp_spreads.json()
        assert len(spreads_data) > 0
        assert spreads_data[0]["method_version"] == "v1"
        assert "spread_bps" in spreads_data[0]

        # 4. 404 tests
        resp_404_spreads = client.get("/spreads?date=2099-01-01")
        assert resp_404_spreads.status_code == 404

        resp_404_hist = client.get("/parity/history?from=2099-01-01&to=2099-01-02")
        assert resp_404_hist.status_code == 404
    finally:
        app.dependency_overrides.clear()
