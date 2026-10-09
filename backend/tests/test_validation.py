"""Unit tests for Stage S3 pure validation functions (no database)."""

from datetime import date
from decimal import Decimal
from pathlib import Path

from app.ingest.parser import BhavcopyRow, parse_bhavcopy
from app.validate.models import CheckName, Severity
from app.validate.validator import validate_bhavcopy, validate_single_row

SYNTHETIC_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "synthetic"


def _sample_row(
    symbol: str = "GOLDM",
    trade_date: date = date(2026, 10, 8),
    expiry_date: date = date(2026, 11, 4),
    open_price: Decimal = Decimal("75000.00"),
    high_price: Decimal = Decimal("75500.00"),
    low_price: Decimal = Decimal("74800.00"),
    close_price: Decimal = Decimal("75200.00"),
    volume: int = 1500,
    open_interest: int = 4200,
) -> BhavcopyRow:
    """Helper to create a valid BhavcopyRow for unit testing."""
    return BhavcopyRow(
        symbol=symbol,
        trade_date=trade_date,
        expiry_date=expiry_date,
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
        volume=volume,
        open_interest=open_interest,
    )


def test_validate_normal_day_synthetic_fixture() -> None:
    """Normal day fixture should have all valid gold contracts accepted without errors."""
    path = SYNTHETIC_DIR / "normal_day.json"
    parse_result = parse_bhavcopy(path.read_bytes(), requested_date=date(2026, 10, 8))
    report = validate_bhavcopy(parse_result, requested_date=date(2026, 10, 8))

    assert not report.has_date_mismatch
    assert len(report.file_issues) == 0
    assert len(report.parse_error_issues) == 0
    assert report.total_quarantined == 0
    assert report.out_of_scope_count == 1  # SILVER was out of scope
    assert report.total_accepted == 10  # 10 gold contract expiries


def test_validate_date_mismatch_is_file_level() -> None:
    """DATE_MISMATCH should log a file-level issue but NOT quarantine valid rows."""
    path = SYNTHETIC_DIR / "different_date_day.json"
    # Requesting Oct 7, but fixture data is Oct 8
    parse_result = parse_bhavcopy(path.read_bytes(), requested_date=date(2026, 10, 7))
    report = validate_bhavcopy(parse_result, requested_date=date(2026, 10, 7))

    assert report.has_date_mismatch
    assert len(report.file_issues) == 1
    assert report.file_issues[0].check_name == CheckName.DATE_MISMATCH
    assert report.file_issues[0].severity == Severity.ERROR

    # Crucial: Rows are valid for Oct 8 and must NOT be quarantined
    assert report.total_accepted == 2
    assert report.total_quarantined == 0


def test_validate_duplicate_rows_quarantines_all_copies() -> None:
    """Duplicate (symbol, expiry, trade_date) must quarantine ALL copies."""
    path = SYNTHETIC_DIR / "duplicate_rows_day.json"
    parse_result = parse_bhavcopy(path.read_bytes(), requested_date=date(2026, 10, 8))
    report = validate_bhavcopy(parse_result, requested_date=date(2026, 10, 8))

    # The fixture has 1 non-duplicate GOLDTEN row, and 2 duplicate GOLDM rows
    assert report.total_accepted == 1
    assert len(report.quarantined_rows) == 2
    for _, issues in report.quarantined_rows:
        dup_issues = [i for i in issues if i.check_name == CheckName.DUPLICATE_ROW]
        assert len(dup_issues) == 1
        assert dup_issues[0].severity == Severity.ERROR


def test_validate_malformed_rows_quarantined() -> None:
    """Malformed rows in parser are captured as parse errors and quarantined."""
    path = SYNTHETIC_DIR / "malformed_rows_day.json"
    parse_result = parse_bhavcopy(path.read_bytes(), requested_date=date(2026, 10, 8))
    report = validate_bhavcopy(parse_result, requested_date=date(2026, 10, 8))

    assert len(report.parse_error_issues) == 3
    assert report.total_quarantined == 3
    assert report.total_accepted == 1  # 1 valid row


def test_non_positive_price_error() -> None:
    """Zero or negative open/high/low/close prices trigger error."""
    row = _sample_row(open_price=Decimal("0.0"))
    issues = validate_single_row(row)
    errs = [i for i in issues if i.check_name == CheckName.NON_POSITIVE_PRICE]
    assert len(errs) == 1
    assert errs[0].severity == Severity.ERROR


def test_inconsistent_ohlc_bounds() -> None:
    """High < low or open/close outside [low, high] triggers error."""
    row1 = _sample_row(high_price=Decimal("74000"), low_price=Decimal("75000"))
    issues1 = validate_single_row(row1)
    assert any(i.check_name == CheckName.INCONSISTENT_OHLC for i in issues1)

    row2 = _sample_row(open_price=Decimal("76000"), high_price=Decimal("75500"))
    issues2 = validate_single_row(row2)
    assert any(i.check_name == CheckName.INCONSISTENT_OHLC for i in issues2)


def test_negative_volume_or_open_interest() -> None:
    """Negative volume or open interest triggers error."""
    row = _sample_row(volume=-5)
    issues = validate_single_row(row)
    assert any(i.check_name == CheckName.NEGATIVE_VOLUME_OR_OI for i in issues)


def test_zero_volume_warning_is_accepted() -> None:
    """Zero volume with positive close price is warning only, keeping row accepted."""
    row = _sample_row(volume=0, close_price=Decimal("75000"))
    issues = validate_single_row(row)
    assert any(
        i.check_name == CheckName.ZERO_VOLUME and i.severity == Severity.WARNING for i in issues
    )
    assert not any(i.severity == Severity.ERROR for i in issues)


def test_expiry_before_trade_date() -> None:
    """Expiry date earlier than trade date is an error."""
    row = _sample_row(trade_date=date(2026, 10, 8), expiry_date=date(2026, 10, 1))
    issues = validate_single_row(row)
    assert any(i.check_name == CheckName.EXPIRY_BEFORE_TRADE_DATE for i in issues)


def test_expiry_outside_window_warning() -> None:
    """Expiry day shifted outside expected window is warning only."""
    # GOLDM window is days 3-5. Day 10 should trigger warning
    row = _sample_row(symbol="GOLDM", expiry_date=date(2026, 11, 10))
    issues = validate_single_row(row)
    assert any(
        i.check_name == CheckName.EXPIRY_OUTSIDE_WINDOW and i.severity == Severity.WARNING
        for i in issues
    )


def test_goldten_before_listing_warning() -> None:
    """GOLDTEN row traded before GOLDTEN_FIRST_DATE triggers warning."""
    row = _sample_row(
        symbol="GOLDTEN",
        trade_date=date(2024, 6, 1),
        expiry_date=date(2024, 6, 28),
    )
    issues = validate_single_row(row, goldten_first_date=date(2025, 1, 1))
    assert any(
        i.check_name == CheckName.GOLDTEN_BEFORE_LISTING and i.severity == Severity.WARNING
        for i in issues
    )
