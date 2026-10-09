"""CLI script to run derived pipeline stages S5 (Normalization) and S6 (Liquidity)."""

import argparse
import os
import sys
from datetime import datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.liquidity.service import compute_liquidity
from app.normalize.service import compute_normalized


def parse_date(date_str: str) -> datetime.date:
    """Parse date from YYYY-MM-DD or DD/MM/YYYY format."""
    s = date_str.strip()
    if "/" in s:
        return datetime.strptime(s, "%d/%m/%Y").date()
    return datetime.strptime(s, "%Y-%m-%d").date()


def main() -> None:
    """Run S5 and S6 derived pipeline computations."""
    parser = argparse.ArgumentParser(
        description="Compute Stage S5 (Normalization) and Stage S6 (Liquidity Confidence)."
    )
    parser.add_argument(
        "--from", dest="date_from", type=parse_date, default=None, help="Start date"
    )
    parser.add_argument("--to", dest="date_to", type=parse_date, default=None, help="End date")

    args = parser.parse_args()

    print("\n--- Running Derived Pipeline Stages (S5 & S6) ---")
    if args.date_from or args.date_to:
        print(f"Date filter: {args.date_from or 'Start'} to {args.date_to or 'Latest'}")

    with SessionLocal() as session:
        with session.begin():
            norm_count = compute_normalized(session, date_from=args.date_from, date_to=args.date_to)
            liq_count = compute_liquidity(session, date_from=args.date_from, date_to=args.date_to)

    print(f"S5 (Normalized Prices): {norm_count} rows written/updated")
    print(f"S6 (Liquidity Scores):  {liq_count} rows written/updated")
    print("-------------------------------------------------\n")


if __name__ == "__main__":
    main()
