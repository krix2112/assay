"""Validation data structures for Stage S3."""

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum
from typing import Any

from app.ingest.parser import BhavcopyRow


class Severity(StrEnum):
    """Severity levels for data quality findings."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class CheckName(StrEnum):
    """Stable identification codes for quality checks."""

    DATE_MISMATCH = "DATE_MISMATCH"
    PARSE_ERROR = "PARSE_ERROR"
    UNKNOWN_SYMBOL = "UNKNOWN_SYMBOL"
    EXPIRY_BEFORE_TRADE_DATE = "EXPIRY_BEFORE_TRADE_DATE"
    EXPIRY_OUTSIDE_WINDOW = "EXPIRY_OUTSIDE_WINDOW"
    NON_POSITIVE_PRICE = "NON_POSITIVE_PRICE"
    INCONSISTENT_OHLC = "INCONSISTENT_OHLC"
    NEGATIVE_VOLUME_OR_OI = "NEGATIVE_VOLUME_OR_OI"
    ZERO_VOLUME = "ZERO_VOLUME"
    DUPLICATE_ROW = "DUPLICATE_ROW"
    GOLDTEN_BEFORE_LISTING = "GOLDTEN_BEFORE_LISTING"
    CONFLICTING_REVISION = "CONFLICTING_REVISION"


@dataclass(frozen=True)
class QualityIssue:
    """A discrete validation finding or error."""

    check_name: str
    severity: str
    reason: str
    trade_date: date | None = None
    symbol: str | None = None
    expiry_date: date | None = None
    raw_row: dict[str, Any] | None = None


@dataclass
class ValidationReport:
    """Full outcome of pure validation on a set of parsed rows."""

    file_issues: list[QualityIssue] = field(default_factory=list)
    accepted_rows: list[BhavcopyRow] = field(default_factory=list)
    quarantined_rows: list[tuple[BhavcopyRow, list[QualityIssue]]] = field(default_factory=list)
    parse_error_issues: list[QualityIssue] = field(default_factory=list)
    out_of_scope_count: int = 0
    has_date_mismatch: bool = False

    @property
    def total_accepted(self) -> int:
        """Count of accepted rows suitable for storage."""
        return len(self.accepted_rows)

    @property
    def total_quarantined(self) -> int:
        """Count of quarantined rows plus unparsed parse errors."""
        return len(self.quarantined_rows) + len(self.parse_error_issues)

    @property
    def all_issues(self) -> list[QualityIssue]:
        """Aggregate list of all quality issues across file, parse, and rows."""
        issues: list[QualityIssue] = []
        issues.extend(self.file_issues)
        issues.extend(self.parse_error_issues)
        for _, row_errs in self.quarantined_rows:
            issues.extend(row_errs)
        # Note: accepted rows might also have warnings that need to be logged
        for _, warns in self.accepted_row_warnings:
            issues.extend(warns)
        return issues

    @property
    def accepted_row_warnings(self) -> list[tuple[BhavcopyRow, list[QualityIssue]]]:
        """Warnings attached to accepted rows."""
        return getattr(self, "_accepted_warnings", [])

    def set_accepted_warnings(self, warnings: list[tuple[BhavcopyRow, list[QualityIssue]]]) -> None:
        """Store warnings associated with accepted rows."""
        self._accepted_warnings = warnings
