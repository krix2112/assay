"""Database tests for Stage S10 track_record, triggers, and tamper verification in temp schemas."""

import uuid
from collections.abc import Generator
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.database import Base, check_database_connection, engine, get_db
from app.main import app
from app.models.contract_spec import ContractSpec
from app.models.track_record_ddl import apply_track_record_triggers
from app.publish.chain import append_record, verify_chain

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
]


@pytest.fixture
def temp_publish_session() -> Generator[Session, None, None]:
    """Create an isolated temporary schema, apply schema tables and shared triggers."""
    if not check_database_connection():
        pytest.skip("Database is unreachable; skipping database integration tests")

    schema_name = f"test_pub_{uuid.uuid4().hex[:12]}"
    conn = engine.connect()

    try:
        conn.execute(text(f"CREATE SCHEMA {schema_name};"))
        conn.execute(text(f"SET search_path TO {schema_name};"))
        conn.commit()

        Base.metadata.create_all(conn)
        conn.commit()

        # Shared trigger installation from app.models.track_record_ddl
        apply_track_record_triggers(conn)
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


def test_trigger_blocks_update_delete_truncate(temp_publish_session: Session) -> None:
    """Requirement 2: Ensure UPDATE, DELETE, and TRUNCATE are strictly blocked by triggers."""
    d = date(2026, 10, 8)
    data1 = {
        "parity": {"score": "80.0", "status": "Computed", "pairs_used": 2, "pairs_excluded": 0},
        "liquidity_counts": {"High": 2},
    }
    entry = append_record(temp_publish_session, d, data=data1)
    assert entry is not None
    temp_publish_session.commit()

    # 1. Test UPDATE raises error
    with pytest.raises(DBAPIError, match="track_record is append-only"):
        temp_publish_session.execute(
            text(f"UPDATE track_record SET canonical_json = 'corrupted' WHERE id = {entry.id};")
        )
    temp_publish_session.rollback()

    # 2. Test DELETE raises error
    with pytest.raises(DBAPIError, match="track_record is append-only"):
        temp_publish_session.execute(text(f"DELETE FROM track_record WHERE id = {entry.id};"))
    temp_publish_session.rollback()

    # 3. Test TRUNCATE raises error
    with pytest.raises(DBAPIError, match="track_record is append-only"):
        temp_publish_session.execute(text("TRUNCATE TABLE track_record;"))
    temp_publish_session.rollback()


def test_append_record_idempotency_and_revision_order(temp_publish_session: Session) -> None:
    """Test idempotent no-op for identical content, revision bump, and id-based chaining."""
    d1 = date(2026, 10, 8)
    d2 = date(2026, 10, 9)

    data_day1 = {
        "parity": {"score": "80.0", "status": "Computed", "pairs_used": 2, "pairs_excluded": 0},
        "liquidity_counts": {"High": 2},
    }
    # 1. Append date 1 -> revision 1
    e1 = append_record(temp_publish_session, d1, data=data_day1)
    assert e1 is not None
    assert e1.revision == 1
    assert e1.prev_hash is None
    temp_publish_session.commit()

    # 2. Re-append identical date 1 -> no-op returns None
    e1_dup = append_record(temp_publish_session, d1, data=data_day1)
    assert e1_dup is None
    temp_publish_session.commit()

    # 3. Append date 2 -> revision 1, linked to e1's hash
    data_day2 = {
        "parity": {"score": "82.5", "status": "Computed", "pairs_used": 2, "pairs_excluded": 0},
        "liquidity_counts": {"High": 3},
    }
    e2 = append_record(temp_publish_session, d2, data=data_day2)
    assert e2 is not None
    assert e2.revision == 1
    assert e2.prev_hash == e1.hash
    temp_publish_session.commit()

    # 4. Append modified date 1 -> revision 2, prev_hash is e2's hash (highest id in chain order!)
    data_day1_revised = {
        "parity": {"score": "80.5", "status": "Computed", "pairs_used": 2, "pairs_excluded": 0},
        "liquidity_counts": {"High": 2},
    }
    e1_rev2 = append_record(temp_publish_session, d1, data=data_day1_revised)
    assert e1_rev2 is not None
    assert e1_rev2.revision == 2
    assert e1_rev2.trade_date == d1
    assert e1_rev2.prev_hash == e2.hash  # Linked to latest entry in table
    temp_publish_session.commit()

    # 5. Verify chain is fully valid
    res = verify_chain(temp_publish_session)
    assert res["ok"] is True
    assert res["entries"] == 3
    assert res["first_broken"] is None


def test_tamper_detection_in_temp_schema(temp_publish_session: Session) -> None:
    """Tamper with record by temporarily disabling trigger, verify failure at exact entry."""
    # Build 3 valid entries
    dates = [date(2026, 10, 5), date(2026, 10, 6), date(2026, 10, 7)]
    for i, d in enumerate(dates):
        data = {
            "parity": {
                "score": str(75.0 + i),
                "status": "Computed",
                "pairs_used": 2,
                "pairs_excluded": 0,
            },
            "liquidity_counts": {"High": 2},
        }
        append_record(temp_publish_session, d, data=data)
    temp_publish_session.commit()

    # Confirm valid initially
    initial_check = verify_chain(temp_publish_session)
    assert initial_check["ok"] is True
    assert initial_check["entries"] == 3

    # Tamper with index 1 (id 2): disable trigger, alter record, re-enable trigger
    temp_publish_session.execute(
        text("ALTER TABLE track_record DISABLE TRIGGER trg_track_record_row_append_only;")
    )
    temp_publish_session.execute(
        text("UPDATE track_record SET canonical_json = :val WHERE id = 2"),
        {"val": '{"tampered":true}'},
    )
    temp_publish_session.execute(
        text("ALTER TABLE track_record ENABLE TRIGGER trg_track_record_row_append_only;")
    )
    temp_publish_session.commit()

    # Verify chain detects tampering at index 1
    tampered_check = verify_chain(temp_publish_session)
    assert tampered_check["ok"] is False
    assert tampered_check["entries"] == 3
    assert tampered_check["first_broken"] == 1


def test_api_track_record_endpoints(temp_publish_session: Session) -> None:
    """Test GET /track-record and GET /track-record/verify endpoints."""

    def override_get_db():
        yield temp_publish_session

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        # Seed 1 entry
        d = date(2026, 10, 8)
        data = {
            "parity": {"score": "88.0", "status": "Computed", "pairs_used": 2, "pairs_excluded": 0},
            "liquidity_counts": {"High": 2},
        }
        append_record(temp_publish_session, d, data=data)
        temp_publish_session.commit()

        # 1. GET /track-record
        resp = client.get("/track-record")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["trade_date"] == "2026-10-08"
        assert items[0]["revision"] == 1
        assert items[0]["prev_hash"] is None
        assert len(items[0]["hash"]) == 64

        # 2. GET /track-record/verify
        v_resp = client.get("/track-record/verify")
        assert v_resp.status_code == 200
        v_data = v_resp.json()
        assert v_data["ok"] is True
        assert v_data["entries"] == 1
        assert v_data["first_broken"] is None
    finally:
        app.dependency_overrides.pop(get_db, None)
