"""Unit tests for Stage S10 publishing, track record, daily brief, and delivery."""

from datetime import date
from decimal import Decimal

import pytest

from app.publish.brief import build_brief
from app.publish.chain import compute_hash, to_canonical_json
from app.publish.notify import sanitize_secrets
from app.publish.record import assert_no_raw_prices, build_record, get_git_commit_hash


def test_build_record_no_raw_prices_allowed() -> None:
    """Prove that build_record and assert_no_raw_prices strictly reject raw price fields."""
    d = date(2026, 10, 8)
    clean_data = {
        "parity": {
            "score": Decimal("84.5"),
            "status": "Computed",
            "pairs_used": 3,
            "pairs_excluded": 1,
        },
        "liquidity_counts": {"High": 4, "Medium": 2},
        "quality_counts": {"PASS": 10},
        "import_counts": {"success": 1},
        "code_version": "abc1234",
        "latest_backtest_verdict": "profitable",
    }
    rec = build_record(d, clean_data)
    assert rec["trade_date"] == "2026-10-08"
    assert rec["parity"]["score"] == "84.5"
    assert rec["code_version"] == "abc1234"
    assert rec["latest_backtest_verdict"] == "profitable"

    # Now verify all forbidden market price/volume fields raise ValueError
    forbidden_keys = [
        "open",
        "high",
        "low",
        "close",
        "volume",
        "open_interest",
        "settlement_price",
        "previous_close",
    ]
    for key in forbidden_keys:
        bad_data = dict(clean_data)
        bad_data[key] = Decimal("100.0")
        with pytest.raises(ValueError, match="Forbidden raw market attribute"):
            build_record(d, bad_data)

    # Test direct assert_no_raw_prices
    with pytest.raises(ValueError):
        assert_no_raw_prices({"data": {"nested_close": 1, "close": 50000}})


def test_git_commit_hash_fallback() -> None:
    """Ensure get_git_commit_hash returns a string and does not raise."""
    h = get_git_commit_hash()
    assert isinstance(h, str)
    assert len(h) > 0


def test_canonical_json_determinism() -> None:
    """Verify canonical JSON produces sorted keys, compact separators, and deterministic hashes."""
    data1 = {"b": 2, "a": 1, "nested": {"z": Decimal("10.5"), "x": date(2026, 10, 8)}}
    data2 = {"nested": {"x": date(2026, 10, 8), "z": Decimal("10.5")}, "a": 1, "b": 2}

    json1 = to_canonical_json(data1)
    json2 = to_canonical_json(data2)

    assert json1 == json2
    assert " " not in json1  # Compact separators (no spaces after ',' or ':')
    assert json1 == '{"a":1,"b":2,"nested":{"x":"2026-10-08","z":"10.5"}}'

    hash1 = compute_hash(json1, prev_hash=None)
    hash2 = compute_hash(json2, prev_hash=None)
    assert hash1 == hash2
    assert len(hash1) == 64


def test_daily_brief_normal_and_length() -> None:
    """Verify normal daily brief with watch pairs and length constraint <= 900 chars."""
    d = date(2026, 10, 8)
    parity = {"score": Decimal("82.4"), "status": "Computed"}
    prev_parity = {"score": Decimal("80.0"), "status": "Computed"}
    spreads = [
        {
            "symbol_a": "GOLDM",
            "symbol_b": "GOLDTEN",
            "robust_z": Decimal("2.35"),
            "weaker_liquidity_label": "High",
        },
        {
            "symbol_a": "GOLDGUINEA",
            "symbol_b": "GOLDPETAL",
            "robust_z": Decimal("-2.10"),
            "weaker_liquidity_label": "Medium",
        },
        {
            "symbol_a": "GOLDM",
            "symbol_b": "GOLDPETAL",
            "robust_z": Decimal("1.20"),
            "weaker_liquidity_label": "High",
        },
    ]
    brief = build_brief(
        trade_date=d,
        parity=parity,
        spreads_summary=spreads,
        prev_parity=prev_parity,
    )
    assert len(brief) <= 900
    assert "Assay Brief 2026-10-08: Parity Score 82.4" in brief
    assert "Score change: +2.4 vs previous day." in brief
    assert "GOLDM/GOLDTEN" in brief
    assert "GOLDGUINEA/GOLDPETAL" in brief
    assert "informational, may not be tradeable" in brief
    assert "Analytics only, not investment advice." in brief


def test_daily_brief_quiet_mode() -> None:
    """Verify quiet mode brief when no pairs meet threshold and no data warnings exist."""
    d = date(2026, 10, 8)
    parity = {"score": Decimal("85.0"), "status": "Computed"}
    prev_parity = {"score": Decimal("85.0"), "status": "Computed"}
    spreads = [
        {
            "symbol_a": "GOLDM",
            "symbol_b": "GOLDTEN",
            "robust_z": Decimal("0.80"),
            "weaker_liquidity_label": "High",
        },
    ]
    brief = build_brief(
        trade_date=d,
        parity=parity,
        spreads_summary=spreads,
        prev_parity=prev_parity,
    )
    assert len(brief) <= 900
    assert "Quiet day: all pairs within normal bounds; nothing needs attention." in brief
    assert "Analytics only, not investment advice." in brief


def test_daily_brief_no_score_and_data_warning() -> None:
    """Verify brief when parity score is absent or data warnings exist."""
    d = date(2026, 10, 8)
    # 1. Missing parity row in DB
    brief_no_row = build_brief(d, parity=None)
    assert "no score today: data is unavailable." in brief_no_row
    assert len(brief_no_row) <= 900

    # 2. Parity status insufficient data
    brief_uncomputed = build_brief(
        d,
        parity={
            "score": None,
            "status": "Insufficient Pairs",
            "reason": "too few active contracts",
        },
        calendar_warnings=["MCX holiday scheduled"],
    )
    assert "no score today: too few active contracts." in brief_uncomputed
    assert "Warning: MCX holiday scheduled" in brief_uncomputed
    assert len(brief_uncomputed) <= 900

    # 3. Data warning with contracts to avoid
    parity = {"score": Decimal("75.0"), "status": "Computed"}
    spreads = [
        {
            "symbol_a": "GOLDM",
            "symbol_b": "GOLDTEN",
            "robust_z": Decimal("0.5"),
            "weaker_liquidity_label": "Unknown",
        },
    ]
    brief_warn = build_brief(
        d,
        parity=parity,
        spreads_summary=spreads,
        quality_summary={"DATE_MISMATCH": 1},
    )
    assert "Contracts to avoid comparing today: GOLDM, GOLDTEN" in brief_warn
    assert "Data check 'DATE_MISMATCH' flagged 1 issue(s)" in brief_warn
    assert len(brief_warn) <= 900


def test_sanitize_secrets() -> None:
    """Ensure secret tokens are redacted from error text."""
    from app.core.config import settings

    orig_token = settings.TELEGRAM_BOT_TOKEN
    try:
        settings.TELEGRAM_BOT_TOKEN = "secret_bot_token_12345"
        msg = "Error connecting to https://api.telegram.org/botsecret_bot_token_12345/sendMessage"
        cleaned = sanitize_secrets(msg)
        assert "secret_bot_token_12345" not in cleaned
        assert "[REDACTED_TELEGRAM_TOKEN]" in cleaned
    finally:
        settings.TELEGRAM_BOT_TOKEN = orig_token
