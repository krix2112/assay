"""CLI script to compute spreads (S7) and parity scores (S8)."""

import argparse
import os
import sys
from datetime import date, datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select

from app.analytics.parity import compute_parity
from app.analytics.spreads import compute_spreads
from app.core.database import SessionLocal
from app.models.normalized_price import NormalizedPriceRecord


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
    """Run spreads and parity analytics over requested date range."""
    parser = argparse.ArgumentParser(
        description="Compute Assay contract spreads (S7) and Parity Scores (S8)."
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

    if from_date and not to_date:
        to_date = from_date
    elif to_date and not from_date:
        from_date = to_date

    with SessionLocal() as session:
        # Determine trade dates to process
        stmt = select(NormalizedPriceRecord.trade_date).distinct()
        if from_date is not None:
            stmt = stmt.where(NormalizedPriceRecord.trade_date >= from_date)
        if to_date is not None:
            stmt = stmt.where(NormalizedPriceRecord.trade_date <= to_date)
        stmt = stmt.order_by(NormalizedPriceRecord.trade_date.asc())

        trade_dates = list(session.execute(stmt).scalars().all())

        if not trade_dates:
            print("No normalized price records found for the specified date range.")
            return

        print(f"Processing analytics for {len(trade_dates)} date(s)...")

        for t_date in trade_dates:
            spread_records = compute_spreads(session, t_date)
            parity_record = compute_parity(session, t_date)

            print(
                f"[{t_date.isoformat()}] "
                f"Spreads: {len(spread_records)} pairs | "
                f"Parity Score: {parity_record.score} "
                f"(status: {parity_record.status}, pairs used: {parity_record.pairs_used})"
            )

        print("Analytics computation complete.")


if __name__ == "__main__":
    main()
