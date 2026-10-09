"""Database integration tests for Stages S5 and S6 in isolated temporary schemas."""

import uuid
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.database import Base, check_database_connection, engine, get_db
from app.main import app
from app.models.contract_spec import ContractSpec
from app.models.liquidity import LiquidityScoreRecord
from app.models.normalized_price import NormalizedPriceRecord
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
def temp_derived_session():
    """Create a temporary schema with a random name, create tables, and drop afterwards."""
    if not check_database_connection():
        pytest.skip("Database is unreachable; skipping database integration tests")

    schema_name = f"test_derived_{uuid.uuid4().hex[:12]}"
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


def test_compute_normalized_and_liquidity_idempotency(temp_derived_session: Session) -> None:
    """Run process_file with allow_synthetic=True, compute S5 and S6, and verify idempotency."""
    from app.liquidity.service import compute_liquidity
    from app.normalize.service import compute_normalized

    normal_file = SYNTHETIC_DIR / "normal_day.json"
    summary = process_file(normal_file, session=temp_derived_session, allow_synthetic=True)
    assert summary.rows_accepted == 10

    # 1. Compute normalization
    n_written1 = compute_normalized(temp_derived_session)
    assert n_written1 == 10
    temp_derived_session.commit()

    # Verify rows in prices_normalized
    norm_rows = temp_derived_session.scalars(select(NormalizedPriceRecord)).all()
    assert len(norm_rows) == 10
    first_norm = norm_rows[0]
    assert first_norm.price_per_gram > Decimal("0")
    assert first_norm.fine_gold_price_per_gram > Decimal("0")

    # Idempotent recomputation
    n_written2 = compute_normalized(temp_derived_session)
    assert n_written2 == 10
    temp_derived_session.commit()
    assert len(temp_derived_session.scalars(select(NormalizedPriceRecord)).all()) == 10

    # 2. Compute liquidity scores
    l_written1 = compute_liquidity(temp_derived_session)
    assert l_written1 == 10
    temp_derived_session.commit()

    # Recomputation is idempotent
    l_written2 = compute_liquidity(temp_derived_session)
    assert l_written2 == 10
    temp_derived_session.commit()
    assert len(temp_derived_session.scalars(select(LiquidityScoreRecord)).all()) == 10


def test_contracts_api_endpoint(temp_derived_session: Session) -> None:
    """Verify GET /contracts/{date} returns 200 on populated date and 404 on missing date."""
    from app.liquidity.service import compute_liquidity
    from app.normalize.service import compute_normalized

    normal_file = SYNTHETIC_DIR / "normal_day.json"
    process_file(normal_file, session=temp_derived_session, allow_synthetic=True)
    compute_normalized(temp_derived_session)
    compute_liquidity(temp_derived_session)
    temp_derived_session.commit()

    # Override get_db dependency to use temp session
    def override_get_db():
        try:
            yield temp_derived_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    try:
        client = TestClient(app)

        # Valid date
        resp_ok = client.get("/contracts/2026-10-08")
        assert resp_ok.status_code == 200
        data = resp_ok.json()
        assert len(data) == 10
        item = data[0]
        assert "symbol" in item
        assert "price_per_gram" in item
        assert "fine_gold_price_per_gram" in item
        assert "volume_ratio" in item
        assert "label" in item

        # Date without data returns 404
        resp_404 = client.get("/contracts/1999-01-01")
        assert resp_404.status_code == 404
        assert "No contract data found" in resp_404.json()["detail"]

        # Invalid date string returns 400
        resp_400 = client.get("/contracts/not-a-date")
        assert resp_400.status_code == 400

    finally:
        app.dependency_overrides.pop(get_db, None)
