"""Database integration tests for Stage S9 walk-forward backtest in isolated temporary schemas."""

import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.analytics.spreads import compute_spreads
from app.backtest.service import execute_backtest
from app.core.database import Base, check_database_connection, engine, get_db
from app.liquidity.service import compute_liquidity
from app.main import app
from app.models.backtest import BacktestRunRecord
from app.models.contract_spec import ContractSpec
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
def temp_backtest_session():
    """Create a temporary schema with a random name, create tables, and drop afterwards."""
    if not check_database_connection():
        pytest.skip("Database is unreachable; skipping database integration tests")

    schema_name = f"test_backtest_{uuid.uuid4().hex[:12]}"
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


def test_execute_backtest_db_idempotency(temp_backtest_session: Session) -> None:
    """Test running execute_backtest from DB and idempotency."""
    # Seed data
    normal_file = SYNTHETIC_DIR / "normal_day.json"
    process_file(normal_file, session=temp_backtest_session, allow_synthetic=True)
    compute_normalized(temp_backtest_session)
    compute_liquidity(temp_backtest_session)
    trade_date = date(2026, 10, 8)
    compute_spreads(temp_backtest_session, trade_date)
    temp_backtest_session.commit()

    # 1. Run backtest
    run1 = execute_backtest(temp_backtest_session, data_from=trade_date, data_to=trade_date)
    assert run1.status == "completed"
    assert run1.data_from == trade_date
    assert run1.data_to == trade_date
    run1_id = run1.id
    temp_backtest_session.commit()

    # 2. Re-run backtest (Idempotency)
    run2 = execute_backtest(temp_backtest_session, data_from=trade_date, data_to=trade_date)
    assert run2.id == run1_id
    temp_backtest_session.commit()

    runs_in_db = temp_backtest_session.scalars(select(BacktestRunRecord)).all()
    assert len(runs_in_db) == 1


def test_api_endpoint_backtest_latest(temp_backtest_session: Session) -> None:
    """Test GET /backtest/latest endpoint."""

    def override_get_db():
        yield temp_backtest_session

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # When no runs exist: 404
        resp_404 = client.get("/backtest/latest")
        assert resp_404.status_code == 404

        # Seed data and run backtest
        normal_file = SYNTHETIC_DIR / "normal_day.json"
        process_file(normal_file, session=temp_backtest_session, allow_synthetic=True)
        compute_normalized(temp_backtest_session)
        compute_liquidity(temp_backtest_session)
        trade_date = date(2026, 10, 8)
        compute_spreads(temp_backtest_session, trade_date)
        temp_backtest_session.commit()

        execute_backtest(temp_backtest_session, data_from=trade_date, data_to=trade_date)
        temp_backtest_session.commit()

        # When run exists: 200
        resp = client.get("/backtest/latest")
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert "summary" in data
        assert "equity_curve" in data
        assert "trades" in data
        assert data["summary"]["verdict"] in (
            "insufficient_data",
            "no_persistent_edge_after_costs",
            "positive_after_costs_unvalidated",
        )
    finally:
        app.dependency_overrides.clear()
