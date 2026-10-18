"""Data Trust Scorecard for Stage S3/S4 validation and quality auditing."""

from datetime import date

from pydantic import BaseModel, Field
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.ingest.parser import TARGET_GOLD_SYMBOLS
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.data_quality import DataQualityLogRecord
from app.models.raw_fetch import RawFetchRecord
from app.validate.models import CheckName, Severity


class CheckCountItem(BaseModel):
    """Aggregation of findings by check identifier and severity."""

    check_name: str
    severity: str
    count: int


class DateAnomalyItem(BaseModel):
    """Date with observed anomalies such as DATE_MISMATCH or no_data."""

    date: str | None
    status: str
    reason: str | None = None


class ContractCoverageItem(BaseModel):
    """Trading days coverage statistics for a specific contract."""

    symbol: str
    first_date: str | None = None
    last_date: str | None = None
    trading_days_present: int = 0


class DataQualitySummaryResponse(BaseModel):
    """Pydantic model representing complete Data Trust Scorecard API response."""

    data_policy: str = (
        "The product itself does not scrape. Local development data is private and not published."
    )
    date_from: str | None = None
    date_to: str | None = None
    files_by_status: dict[str, int] = Field(default_factory=dict)
    rows_accepted: int = 0
    rows_quarantined: int = 0
    issues_by_check: list[CheckCountItem] = Field(default_factory=list)
    anomalous_dates: list[DateAnomalyItem] = Field(default_factory=list)
    contract_coverage: list[ContractCoverageItem] = Field(default_factory=list)


def build_scorecard(
    session: Session,
    date_from: date | None = None,
    date_to: date | None = None,
) -> DataQualitySummaryResponse:
    """Build the Data Trust Scorecard aggregating import, validation, and coverage metrics."""
    # 1. Files imported by status
    fetch_stmt = select(RawFetchRecord.status, func.count(RawFetchRecord.id)).group_by(
        RawFetchRecord.status
    )
    if date_from:
        fetch_stmt = fetch_stmt.where(
            func.coalesce(RawFetchRecord.returned_trade_date, RawFetchRecord.requested_date)
            >= date_from
        )
    if date_to:
        fetch_stmt = fetch_stmt.where(
            func.coalesce(RawFetchRecord.returned_trade_date, RawFetchRecord.requested_date)
            <= date_to
        )

    files_by_status: dict[str, int] = {}
    for status_str, count in session.execute(fetch_stmt):
        files_by_status[str(status_str)] = count

    # 2. Accepted rows count
    accepted_stmt = select(func.count()).select_from(BhavcopyRowRecord)
    if date_from:
        accepted_stmt = accepted_stmt.where(BhavcopyRowRecord.trade_date >= date_from)
    if date_to:
        accepted_stmt = accepted_stmt.where(BhavcopyRowRecord.trade_date <= date_to)
    rows_accepted = session.scalar(accepted_stmt) or 0

    # 3. Quarantined rows count (error-severity row-level logs)
    quarantined_stmt = (
        select(func.count())
        .select_from(DataQualityLogRecord)
        .where(
            DataQualityLogRecord.severity == Severity.ERROR,
            DataQualityLogRecord.check_name != CheckName.DATE_MISMATCH,
        )
    )
    if date_from:
        quarantined_stmt = quarantined_stmt.where(DataQualityLogRecord.trade_date >= date_from)
    if date_to:
        quarantined_stmt = quarantined_stmt.where(DataQualityLogRecord.trade_date <= date_to)
    rows_quarantined = session.scalar(quarantined_stmt) or 0

    # 4. Issue counts by check_name and severity
    issue_stmt = (
        select(
            DataQualityLogRecord.check_name,
            DataQualityLogRecord.severity,
            func.count(DataQualityLogRecord.id),
        )
        .group_by(DataQualityLogRecord.check_name, DataQualityLogRecord.severity)
        .order_by(DataQualityLogRecord.severity, DataQualityLogRecord.check_name)
    )
    if date_from:
        issue_stmt = issue_stmt.where(DataQualityLogRecord.trade_date >= date_from)
    if date_to:
        issue_stmt = issue_stmt.where(DataQualityLogRecord.trade_date <= date_to)

    issues_by_check: list[CheckCountItem] = [
        CheckCountItem(check_name=c_name, severity=sev, count=cnt)
        for c_name, sev, cnt in session.execute(issue_stmt)
    ]

    # 5. Dates with DATE_MISMATCH or no_data
    anomalous_dates: list[DateAnomalyItem] = []
    anomaly_fetches_stmt = (
        select(RawFetchRecord)
        .where(RawFetchRecord.status.in_(["date_mismatch", "no_data"]))
        .order_by(RawFetchRecord.imported_at)
    )
    for rf in session.scalars(anomaly_fetches_stmt):
        eff_date = rf.returned_trade_date or rf.requested_date
        reason_text = (
            f"Returned trade date differs from requested date ({rf.requested_date})"
            if rf.status == "date_mismatch"
            else "Exchange response indicated 'No data found'"
        )
        anomalous_dates.append(
            DateAnomalyItem(
                date=eff_date.isoformat() if eff_date else None,
                status=rf.status,
                reason=reason_text,
            )
        )

    # 6. Per-contract coverage (first date, last date, trading days count)
    coverage_stmt = (
        select(
            BhavcopyRowRecord.symbol,
            func.min(BhavcopyRowRecord.trade_date),
            func.max(BhavcopyRowRecord.trade_date),
            func.count(distinct(BhavcopyRowRecord.trade_date)),
        )
        .group_by(BhavcopyRowRecord.symbol)
        .order_by(BhavcopyRowRecord.symbol)
    )
    if date_from:
        coverage_stmt = coverage_stmt.where(BhavcopyRowRecord.trade_date >= date_from)
    if date_to:
        coverage_stmt = coverage_stmt.where(BhavcopyRowRecord.trade_date <= date_to)

    found_coverage: dict[str, tuple[date | None, date | None, int]] = {}
    for sym, first_d, last_d, day_count in session.execute(coverage_stmt):
        found_coverage[sym] = (first_d, last_d, day_count)

    contract_coverage: list[ContractCoverageItem] = []
    # Ensure all four gold contracts appear in predictable order
    for sym in sorted(TARGET_GOLD_SYMBOLS):
        if sym in found_coverage:
            f_d, l_d, cnt = found_coverage[sym]
            contract_coverage.append(
                ContractCoverageItem(
                    symbol=sym,
                    first_date=f_d.isoformat() if f_d else None,
                    last_date=l_d.isoformat() if l_d else None,
                    trading_days_present=cnt,
                )
            )
        else:
            contract_coverage.append(
                ContractCoverageItem(
                    symbol=sym,
                    first_date=None,
                    last_date=None,
                    trading_days_present=0,
                )
            )

    return DataQualitySummaryResponse(
        date_from=date_from.isoformat() if date_from else None,
        date_to=date_to.isoformat() if date_to else None,
        files_by_status=files_by_status,
        rows_accepted=rows_accepted,
        rows_quarantined=rows_quarantined,
        issues_by_check=issues_by_check,
        anomalous_dates=anomalous_dates,
        contract_coverage=contract_coverage,
    )
