"""Unit tests for Stage S5: Normalization with hand-calculated Decimal verifications."""

from datetime import date
from decimal import Decimal

from app.models.bhavcopy import BhavcopyRowRecord
from app.models.contract_spec import ContractSpec
from app.normalize.service import normalize_row


def test_hand_calculated_goldm_normalization() -> None:
    """GOLDM: 100g trading, 10g quote unit, 0.995 purity."""
    spec = ContractSpec(
        symbol="GOLDM",
        trading_unit_grams=Decimal("100"),
        quote_unit_grams=Decimal("10"),
        purity=Decimal("0.995"),
        expiry_window_start_day=3,
        expiry_window_end_day=5,
        source_note="from challenge brief",
    )
    # Settlement close: 75000.00
    # Expected price_per_gram = 75000 / 10 = 7500
    # Expected fine_gold_price_per_gram = 7500 / 0.995 = 7537.688442211055276381909548...
    row = BhavcopyRowRecord(
        symbol="GOLDM",
        expiry_date=date(2026, 11, 4),
        trade_date=date(2026, 10, 8),
        open=Decimal("74900"),
        high=Decimal("75200"),
        low=Decimal("74800"),
        close=Decimal("75000.00"),
        volume=1200,
        open_interest=3500,
        raw_fetch_id=1,
    )

    norm = normalize_row(row, spec)
    assert norm.price_per_gram == Decimal("7500")
    # Verify exact Decimal calculation
    expected_fine = Decimal("7500") / Decimal("0.995")
    assert norm.fine_gold_price_per_gram == expected_fine
    assert norm.method_version == "v1"


def test_hand_calculated_goldten_normalization() -> None:
    """GOLDTEN: 10g trading, 10g quote unit, 0.999 purity."""
    spec = ContractSpec(
        symbol="GOLDTEN",
        trading_unit_grams=Decimal("10"),
        quote_unit_grams=Decimal("10"),
        purity=Decimal("0.999"),
        expiry_window_start_day=27,
        expiry_window_end_day=31,
        source_note="from challenge brief",
    )
    # Settlement close: 76000.00
    # Expected price_per_gram = 76000 / 10 = 7600
    # Expected fine_gold_price_per_gram = 7600 / 0.999 = 7607.607607607607607607607608...
    row = BhavcopyRowRecord(
        symbol="GOLDTEN",
        expiry_date=date(2026, 10, 30),
        trade_date=date(2026, 10, 8),
        open=Decimal("75900"),
        high=Decimal("76100"),
        low=Decimal("75800"),
        close=Decimal("76000.00"),
        volume=800,
        open_interest=2000,
        raw_fetch_id=1,
    )

    norm = normalize_row(row, spec)
    assert norm.price_per_gram == Decimal("7600")
    expected_fine = Decimal("7600") / Decimal("0.999")
    assert norm.fine_gold_price_per_gram == expected_fine


def test_hand_calculated_goldguinea_normalization() -> None:
    """GOLDGUINEA: 8g trading, 8g quote unit, 0.999 purity."""
    spec = ContractSpec(
        symbol="GOLDGUINEA",
        trading_unit_grams=Decimal("8"),
        quote_unit_grams=Decimal("8"),
        purity=Decimal("0.999"),
        expiry_window_start_day=27,
        expiry_window_end_day=31,
        source_note="from challenge brief",
    )
    # Settlement close: 60800.00 (quoted per 8g)
    # Expected price_per_gram = 60800 / 8 = 7600
    # Expected fine_gold_price_per_gram = 7600 / 0.999 = 7607.607607607607607607607608...
    row = BhavcopyRowRecord(
        symbol="GOLDGUINEA",
        expiry_date=date(2026, 10, 30),
        trade_date=date(2026, 10, 8),
        open=Decimal("60700"),
        high=Decimal("60900"),
        low=Decimal("60600"),
        close=Decimal("60800.00"),
        volume=400,
        open_interest=900,
        raw_fetch_id=1,
    )

    norm = normalize_row(row, spec)
    assert norm.price_per_gram == Decimal("7600")
    expected_fine = Decimal("7600") / Decimal("0.999")
    assert norm.fine_gold_price_per_gram == expected_fine


def test_hand_calculated_goldpetal_normalization() -> None:
    """GOLDPETAL: 1g trading, 1g quote unit, 0.999 purity."""
    spec = ContractSpec(
        symbol="GOLDPETAL",
        trading_unit_grams=Decimal("1"),
        quote_unit_grams=Decimal("1"),
        purity=Decimal("0.999"),
        expiry_window_start_day=27,
        expiry_window_end_day=31,
        source_note="from challenge brief",
    )
    # Settlement close: 7650.00 (quoted per 1g)
    # Expected price_per_gram = 7650 / 1 = 7650
    # Expected fine_gold_price_per_gram = 7650 / 0.999 = 7657.657657657657657657657658...
    row = BhavcopyRowRecord(
        symbol="GOLDPETAL",
        expiry_date=date(2026, 10, 30),
        trade_date=date(2026, 10, 8),
        open=Decimal("7640"),
        high=Decimal("7660"),
        low=Decimal("7630"),
        close=Decimal("7650.00"),
        volume=2500,
        open_interest=5500,
        raw_fetch_id=1,
    )

    norm = normalize_row(row, spec)
    assert norm.price_per_gram == Decimal("7650")
    expected_fine = Decimal("7650") / Decimal("0.999")
    assert norm.fine_gold_price_per_gram == expected_fine
