"""Pure validation functions for Stage S3 (Validate).

Strictly decoupled from database access. Takes parsed rows and returns
structured reports with partitioned accepted and quarantined rows.
"""

from collections import Counter
from datetime import date
from typing import Any

from app.core.config import settings
from app.ingest.parser import (
    TARGET_GOLD_SYMBOLS,
    BhavcopyParseResult,
    BhavcopyRow,
)
from app.validate.models import CheckName, QualityIssue, Severity, ValidationReport

# Reference contract expiry windows from challenge brief:
# GOLDM: days 3-5 of expiry month
# GOLDTEN, GOLDGUINEA, GOLDPETAL: days 27-31 of expiry month
DEFAULT_EXPIRY_WINDOWS: dict[str, tuple[int, int]] = {
    "GOLDM": (3, 5),
    "GOLDTEN": (27, 31),
    "GOLDGUINEA": (27, 31),
    "GOLDPETAL": (27, 31),
}


def _row_to_dict(row: BhavcopyRow) -> dict[str, Any]:
    """Serialize BhavcopyRow to dictionary for raw_row audit log."""
    return {
        "symbol": row.symbol,
        "trade_date": row.trade_date.isoformat(),
        "expiry_date": row.expiry_date.isoformat(),
        "open": str(row.open),
        "high": str(row.high),
        "low": str(row.low),
        "close": str(row.close),
        "volume": row.volume,
        "open_interest": row.open_interest,
    }


def validate_single_row(
    row: BhavcopyRow,
    is_duplicate: bool = False,
    expiry_windows: dict[str, tuple[int, int]] | None = None,
    goldten_first_date: date | None = None,
) -> list[QualityIssue]:
    """Execute all row-level validation checks on a single BhavcopyRow.

    Returns:
        List of QualityIssue instances found on this row (errors and warnings).
    """
    issues: list[QualityIssue] = []
    row_dict = _row_to_dict(row)
    windows = expiry_windows or DEFAULT_EXPIRY_WINDOWS
    first_goldten = goldten_first_date or settings.GOLDTEN_FIRST_DATE

    # 1. DUPLICATE_ROW (error)
    if is_duplicate:
        issues.append(
            QualityIssue(
                check_name=CheckName.DUPLICATE_ROW,
                severity=Severity.ERROR,
                reason=(
                    f"Duplicate contract key ({row.symbol}, {row.expiry_date}, {row.trade_date}) "
                    f"appeared multiple times in the same file; all copies quarantined"
                ),
                trade_date=row.trade_date,
                symbol=row.symbol,
                expiry_date=row.expiry_date,
                raw_row=row_dict,
            )
        )

    # 2. EXPIRY_BEFORE_TRADE_DATE (error)
    if row.expiry_date < row.trade_date:
        issues.append(
            QualityIssue(
                check_name=CheckName.EXPIRY_BEFORE_TRADE_DATE,
                severity=Severity.ERROR,
                reason=(
                    f"Contract expiry date {row.expiry_date} is earlier than "
                    f"trade date {row.trade_date}"
                ),
                trade_date=row.trade_date,
                symbol=row.symbol,
                expiry_date=row.expiry_date,
                raw_row=row_dict,
            )
        )

    # 3. EXPIRY_OUTSIDE_WINDOW (warning)
    if row.symbol in windows:
        start_day, end_day = windows[row.symbol]
        expiry_day = row.expiry_date.day
        if not (start_day <= expiry_day <= end_day):
            issues.append(
                QualityIssue(
                    check_name=CheckName.EXPIRY_OUTSIDE_WINDOW,
                    severity=Severity.WARNING,
                    reason=(
                        f"Contract expiry day {expiry_day} falls outside standard "
                        f"window [{start_day}, {end_day}] for {row.symbol} "
                        f"(acceptable holiday/schedule shift)"
                    ),
                    trade_date=row.trade_date,
                    symbol=row.symbol,
                    expiry_date=row.expiry_date,
                    raw_row=row_dict,
                )
            )

    # 4. NON_POSITIVE_PRICE (error)
    if row.open <= 0 or row.high <= 0 or row.low <= 0 or row.close <= 0:
        issues.append(
            QualityIssue(
                check_name=CheckName.NON_POSITIVE_PRICE,
                severity=Severity.ERROR,
                reason=(
                    f"Non-positive price detected: open={row.open}, "
                    f"high={row.high}, low={row.low}, close={row.close}"
                ),
                trade_date=row.trade_date,
                symbol=row.symbol,
                expiry_date=row.expiry_date,
                raw_row=row_dict,
            )
        )

    # 5. INCONSISTENT_OHLC (error)
    if (
        row.high < row.low
        or row.open < row.low
        or row.open > row.high
        or row.close < row.low
        or row.close > row.high
    ):
        issues.append(
            QualityIssue(
                check_name=CheckName.INCONSISTENT_OHLC,
                severity=Severity.ERROR,
                reason=(
                    f"Inconsistent OHLC bounds: high={row.high}, low={row.low}, "
                    f"open={row.open}, close={row.close}"
                ),
                trade_date=row.trade_date,
                symbol=row.symbol,
                expiry_date=row.expiry_date,
                raw_row=row_dict,
            )
        )

    # 6. NEGATIVE_VOLUME_OR_OI (error)
    if row.volume < 0 or row.open_interest < 0:
        issues.append(
            QualityIssue(
                check_name=CheckName.NEGATIVE_VOLUME_OR_OI,
                severity=Severity.ERROR,
                reason=(f"Negative volume ({row.volume}) or open interest ({row.open_interest})"),
                trade_date=row.trade_date,
                symbol=row.symbol,
                expiry_date=row.expiry_date,
                raw_row=row_dict,
            )
        )

    # 7. ZERO_VOLUME (warning)
    if row.volume == 0 and row.close > 0:
        issues.append(
            QualityIssue(
                check_name=CheckName.ZERO_VOLUME,
                severity=Severity.WARNING,
                reason=f"Zero trading volume recorded with positive close price {row.close}",
                trade_date=row.trade_date,
                symbol=row.symbol,
                expiry_date=row.expiry_date,
                raw_row=row_dict,
            )
        )

    # 8. GOLDTEN_BEFORE_LISTING (warning)
    if row.symbol == "GOLDTEN" and row.trade_date < first_goldten:
        issues.append(
            QualityIssue(
                check_name=CheckName.GOLDTEN_BEFORE_LISTING,
                severity=Severity.WARNING,
                reason=(
                    f"GOLDTEN traded on {row.trade_date} before estimated listing date "
                    f"{first_goldten} (approximate threshold)"
                ),
                trade_date=row.trade_date,
                symbol=row.symbol,
                expiry_date=row.expiry_date,
                raw_row=row_dict,
            )
        )

    return issues


def validate_bhavcopy(
    parse_result: BhavcopyParseResult,
    requested_date: date | None = None,
    expiry_windows: dict[str, tuple[int, int]] | None = None,
    goldten_first_date: date | None = None,
) -> ValidationReport:
    """Pure validation pipeline across file-level and row-level structures.

    Rules:
    - DATE_MISMATCH is a file-level status: logged to file_issues, sets has_date_mismatch=True,
      but does NOT quarantine rows. Rows remain valid for their true returned trade date.
    - PARSE_ERROR: all parse errors are converted to quarantined error issues with raw payloads.
    - UNKNOWN_SYMBOL: non-gold symbols are counted as out_of_scope and never logged as failures.
    - DUPLICATE_ROW: duplicate contract keys within the file quarantine ALL copies.
    - Any row with severity == 'error' is quarantined (not stored).
    - Rows with only 'warning' are accepted and stored (warnings logged).
    """
    report = ValidationReport()

    # 1. File-level check: DATE_MISMATCH
    req_date = requested_date or parse_result.requested_date
    ret_date = parse_result.trade_date

    if req_date is not None and ret_date is not None and ret_date != req_date:
        report.has_date_mismatch = True
        report.file_issues.append(
            QualityIssue(
                check_name=CheckName.DATE_MISMATCH,
                severity=Severity.ERROR,
                reason=(
                    f"Returned trade date ({ret_date}) differs from requested date ({req_date})"
                ),
                trade_date=ret_date,
                symbol=None,
                expiry_date=None,
                raw_row={
                    "requested_date": req_date.isoformat(),
                    "returned_date": ret_date.isoformat(),
                },
            )
        )

    # 2. Convert unparsed ParseErrors into quarantined issues
    for pe in parse_result.errors:
        raw_dict = pe.raw_row if isinstance(pe.raw_row, dict) else {"raw": str(pe.raw_row)}
        report.parse_error_issues.append(
            QualityIssue(
                check_name=CheckName.PARSE_ERROR,
                severity=Severity.ERROR,
                reason=pe.reason,
                trade_date=ret_date,
                symbol=raw_dict.get("Symbol"),
                expiry_date=None,
                raw_row=raw_dict,
            )
        )

    # 3. Filter gold contracts vs out-of-scope contracts
    gold_rows: list[BhavcopyRow] = []
    for row in parse_result.rows:
        if row.symbol not in TARGET_GOLD_SYMBOLS:
            report.out_of_scope_count += 1
        else:
            gold_rows.append(row)

    # 4. Check for duplicate contract keys (symbol, expiry_date, trade_date)
    key_counts: Counter[tuple[str, date, date]] = Counter(
        (r.symbol, r.expiry_date, r.trade_date) for r in gold_rows
    )

    # 5. Validate each gold contract row
    accepted_rows: list[BhavcopyRow] = []
    quarantined_rows: list[tuple[BhavcopyRow, list[QualityIssue]]] = []
    accepted_warnings: list[tuple[BhavcopyRow, list[QualityIssue]]] = []

    for row in gold_rows:
        key = (row.symbol, row.expiry_date, row.trade_date)
        is_dup = key_counts[key] > 1

        row_issues = validate_single_row(
            row=row,
            is_duplicate=is_dup,
            expiry_windows=expiry_windows,
            goldten_first_date=goldten_first_date,
        )

        has_errors = any(i.severity == Severity.ERROR for i in row_issues)
        has_warnings = any(i.severity == Severity.WARNING for i in row_issues)

        if has_errors:
            quarantined_rows.append((row, row_issues))
        else:
            accepted_rows.append(row)
            if has_warnings:
                accepted_warnings.append((row, row_issues))

    report.accepted_rows = accepted_rows
    report.quarantined_rows = quarantined_rows
    report.set_accepted_warnings(accepted_warnings)

    return report
