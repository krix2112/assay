"""CLI script to display all stored gold contracts and metrics for a given date."""

import argparse
import os
import sys
from datetime import datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.liquidity import LiquidityScoreRecord
from app.models.normalized_price import NormalizedPriceRecord


def parse_date(date_str: str) -> datetime.date:
    """Parse date from YYYY-MM-DD or DD/MM/YYYY format."""
    s = date_str.strip()
    if "/" in s:
        return datetime.strptime(s, "%d/%m/%Y").date()
    return datetime.strptime(s, "%Y-%m-%d").date()


def main() -> None:
    """Show contract data for target date."""
    parser = argparse.ArgumentParser(
        description="Display contract market and derived metrics for a specific trade date."
    )
    parser.add_argument("date", type=parse_date, help="Trade date (YYYY-MM-DD or DD/MM/YYYY)")
    args = parser.parse_args()
    target_date = args.date

    with SessionLocal() as session:
        # Query bhavcopy rows joined with normalized prices and liquidity scores
        stmt = (
            select(
                BhavcopyRowRecord,
                NormalizedPriceRecord,
                LiquidityScoreRecord,
            )
            .outerjoin(
                NormalizedPriceRecord,
                (BhavcopyRowRecord.symbol == NormalizedPriceRecord.symbol)
                & (BhavcopyRowRecord.expiry_date == NormalizedPriceRecord.expiry_date)
                & (BhavcopyRowRecord.trade_date == NormalizedPriceRecord.trade_date),
            )
            .outerjoin(
                LiquidityScoreRecord,
                (BhavcopyRowRecord.symbol == LiquidityScoreRecord.symbol)
                & (BhavcopyRowRecord.expiry_date == LiquidityScoreRecord.expiry_date)
                & (BhavcopyRowRecord.trade_date == LiquidityScoreRecord.trade_date),
            )
            .where(BhavcopyRowRecord.trade_date == target_date)
            .order_by(BhavcopyRowRecord.symbol, BhavcopyRowRecord.expiry_date)
        )

        results = session.execute(stmt).all()

    if not results:
        print(f"\nNo contract data found for date: {target_date.strftime('%Y-%m-%d')}\n")
        sys.exit(0)

    print(f"\n=== ASSAY CONTRACT INTELLIGENCE: {target_date.strftime('%Y-%m-%d')} ===")
    header = (
        f"{'Symbol':<12} {'Expiry':<12} {'Close':<12} {'Price/g':<12} "
        f"{'Fine/g':<12} {'Vol Ratio':<10} {'OI Ratio':<10} {'DTE':<6} {'Label':<12}"
    )
    print(header)
    print("-" * len(header))

    for bhav, norm, liq in results:
        close_str = f"{float(bhav.close):.2f}"
        ppg_str = f"{float(norm.price_per_gram):.2f}" if norm else "N/A"
        fine_str = f"{float(norm.fine_gold_price_per_gram):.2f}" if norm else "N/A"
        vol_r_str = (
            f"{float(liq.volume_ratio):.2f}" if liq and liq.volume_ratio is not None else "N/A"
        )
        oi_r_str = f"{float(liq.oi_ratio):.2f}" if liq and liq.oi_ratio is not None else "N/A"
        dte_str = str(liq.days_to_expiry) if liq else str((bhav.expiry_date - bhav.trade_date).days)
        label_str = liq.label if liq else "Unscored"

        print(
            f"{bhav.symbol:<12} {bhav.expiry_date.strftime('%Y-%m-%d'):<12} "
            f"{close_str:<12} {ppg_str:<12} {fine_str:<12} "
            f"{vol_r_str:<10} {oi_r_str:<10} {dte_str:<6} {label_str:<12}"
        )

    print("=" * len(header) + "\n")


if __name__ == "__main__":
    main()
