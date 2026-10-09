"""CLI script to display Assay Data Trust Scorecard in the terminal."""

import argparse
import os
import sys
from datetime import datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.validate.scorecard import build_scorecard


def parse_date(date_str: str) -> datetime.date:
    """Parse date from YYYY-MM-DD or DD/MM/YYYY format."""
    s = date_str.strip()
    if "/" in s:
        return datetime.strptime(s, "%d/%m/%Y").date()
    return datetime.strptime(s, "%Y-%m-%d").date()


def main() -> None:
    """Print the Data Trust Scorecard."""
    parser = argparse.ArgumentParser(description="Display Assay Data Trust Scorecard.")
    parser.add_argument(
        "--from", dest="date_from", type=parse_date, default=None, help="Start date"
    )
    parser.add_argument("--to", dest="date_to", type=parse_date, default=None, help="End date")
    args = parser.parse_args()

    with SessionLocal() as session:
        scorecard = build_scorecard(session, date_from=args.date_from, date_to=args.date_to)

    print("\n=======================================================")
    print("               ASSAY DATA TRUST SCORECARD              ")
    print("=======================================================")
    if scorecard.date_from or scorecard.date_to:
        print(f"Date Range: {scorecard.date_from or 'Start'} to {scorecard.date_to or 'Latest'}\n")

    # 1. File Status Breakdown
    print("--- 1. Files Imported by Status ---")
    if not scorecard.files_by_status:
        print("  No files imported yet.")
    for status, count in scorecard.files_by_status.items():
        print(f"  {status:<18}: {count}")

    # 2. Rows Accepted vs Quarantined
    print("\n--- 2. Market Row Storage & Quarantine ---")
    print(f"  Accepted Rows stored:       {scorecard.rows_accepted}")
    print(f"  Quarantined Rows (errors):  {scorecard.rows_quarantined}")
    total_market_rows = scorecard.rows_accepted + scorecard.rows_quarantined
    if total_market_rows > 0:
        health_pct = (scorecard.rows_accepted / total_market_rows) * 100
        print(f"  Health Rate:                {health_pct:.1f}%")

    # 3. Validation Issues
    print("\n--- 3. Quality Findings by Check & Severity ---")
    if not scorecard.issues_by_check:
        print("  Zero quality issues recorded.")
    else:
        for item in scorecard.issues_by_check:
            print(f"  [{item.severity.upper():<7}] {item.check_name:<26}: {item.count}")

    # 4. Anomalous Dates
    print("\n--- 4. Anomalous Dates (Date Mismatch / No Data) ---")
    if not scorecard.anomalous_dates:
        print("  No date anomalies recorded.")
    else:
        for anomaly in scorecard.anomalous_dates:
            print(f"  Date: {anomaly.date} | Status: {anomaly.status} | {anomaly.reason}")

    # 5. Contract Coverage
    print("\n--- 5. Per-Contract Coverage ---")
    print(f"  {'Symbol':<12} {'First Date':<12} {'Last Date':<12} {'Trading Days':<12}")
    print(f"  {'-' * 12} {'-' * 12} {'-' * 12} {'-' * 12}")
    for cov in scorecard.contract_coverage:
        f_d = cov.first_date or "N/A"
        l_d = cov.last_date or "N/A"
        print(f"  {cov.symbol:<12} {f_d:<12} {l_d:<12} {cov.trading_days_present:<12}")

    print("=======================================================\n")


if __name__ == "__main__":
    main()
