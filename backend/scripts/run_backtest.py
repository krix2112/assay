"""CLI script to run walk-forward backtest (Stage S9)."""

import argparse
import os
import sys
from datetime import date, datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.backtest.service import execute_backtest
from app.core.database import SessionLocal


def parse_date(date_str: str) -> date:
    """Parse date from YYYY-MM-DD or DD/MM/YYYY."""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            pass
    raise argparse.ArgumentTypeError(
        f"Invalid date '{date_str}'. Expected format YYYY-MM-DD (e.g. 2026-03-05)."
    )


def main() -> None:
    """Run backtest simulation over requested date range."""
    parser = argparse.ArgumentParser(
        description="Run Assay walk-forward backtest simulation with costs and attribution."
    )
    parser.add_argument(
        "--from",
        dest="from_date",
        type=parse_date,
        default=None,
        help="Start trade date (inclusive, YYYY-MM-DD)",
    )
    parser.add_argument(
        "--to",
        dest="to_date",
        type=parse_date,
        default=None,
        help="End trade date (inclusive, YYYY-MM-DD)",
    )

    args = parser.parse_args()
    from_date: date | None = args.from_date
    to_date: date | None = args.to_date

    with SessionLocal() as session:
        try:
            run_rec = execute_backtest(session, data_from=from_date, data_to=to_date)
            summary = run_rec.summary
            headline = summary.get("headline", {})
            print(f"Backtest Run Completed: {run_rec.id}")
            print(
                f"Data range: {run_rec.data_from} to {run_rec.data_to} "
                f"(train cutoff: {run_rec.train_to})"
            )
            print(f"Verdict: {summary.get('verdict')}")
            print(f"Held-Out Trades: {headline.get('trades')}, Net P&L: {headline.get('net_pnl')}")
            print(f"Notice: {summary.get('disclaimer')}")
        except Exception as e:
            print(f"Backtest failed: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
