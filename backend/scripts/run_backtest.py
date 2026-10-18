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
            train_sum = summary.get("train_summary", {})
            held_out_sum = summary.get("held_out_summary", {})

            verdict = summary.get("verdict")
            held_out_days = held_out_sum.get("days", 0)
            held_out_trades = held_out_sum.get("trades", 0)
            held_out_net_pnl = held_out_sum.get("net_pnl", 0.0)
            train_net_pnl = train_sum.get("net_pnl", 0.0)
            train_costs = train_sum.get("costs", 0.0)
            held_out_costs = held_out_sum.get("costs", 0.0)

            # Attribution
            attribution = held_out_sum.get("attribution", {})
            beta = attribution.get("beta")
            alpha = attribution.get("alpha")
            r_sq = attribution.get("r_squared")

            # Determine reason for verdict
            from app.core.config import settings

            min_trades = settings.BACKTEST_MIN_TRADES
            min_days = settings.BACKTEST_MIN_DAYS
            if held_out_trades < min_trades or held_out_days < min_days:
                reason = (
                    f"Held-out period has {held_out_days} days and {held_out_trades} trades, "
                    f"which is below minimum requirements ({min_days} days, "
                    f"{min_trades} trades)."
                )
            elif held_out_net_pnl > 0:
                reason = (
                    f"Held-out period achieved positive net P&L ({held_out_net_pnl}) after costs "
                    f"across {held_out_trades} trades and {held_out_days} days."
                )
            else:
                reason = (
                    f"Held-out period achieved non-positive net P&L "
                    f"({held_out_net_pnl}) after costs across {held_out_trades} "
                    f"trades and {held_out_days} days."
                )

            print("=== BACKTEST RUN SUMMARY ===")
            print(f"Run ID:        {run_rec.id}")
            print(
                f"Data Range:    {run_rec.data_from} to {run_rec.data_to} "
                f"(train cutoff: {run_rec.train_to})"
            )
            print(f"Verdict:       {verdict}")
            print(f"Verdict Reason:{reason}")
            print("\n--- PERFORMANCE METRICS ---")
            print(f"Held-Out Days:   {held_out_days}")
            print(f"Held-Out Trades: {held_out_trades}")
            print(f"Train Trades:    {train_sum.get('trades', 0)}")
            print(f"Train Net P&L:   {train_net_pnl} (costs: {train_costs})")
            print(f"Held-Out Net P&L:{held_out_net_pnl} (costs: {held_out_costs})")
            print("\n--- ATTRIBUTION (HELD-OUT) ---")
            print(f"Beta:      {beta}")
            print(f"Alpha:     {alpha}")
            print(f"R-squared: {r_sq}")
            print(f"\nNotice: {summary.get('disclaimer')} {summary.get('execution_notice')}")
        except Exception as e:
            print(f"Backtest failed: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
