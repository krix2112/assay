"""Stage S9: Attribution regression and performance summary metrics."""

from decimal import Decimal
from typing import Any

from app.core.config import settings


def compute_attribution(
    strategy_returns: list[float],
    gold_returns: list[float],
    min_days: int = settings.BACKTEST_ATTRIB_MIN_DAYS,
) -> dict[str, Any]:
    """Regress strategy daily returns on benchmark gold returns.

    If fewer than min_days, return 'insufficient data' with no numbers.
    """
    n = len(strategy_returns)
    if n < min_days or len(gold_returns) != n:
        return {"status": "insufficient data"}

    mean_x = sum(gold_returns) / n
    mean_y = sum(strategy_returns) / n

    s_xx = sum((x - mean_x) ** 2 for x in gold_returns)
    s_yy = sum((y - mean_y) ** 2 for y in strategy_returns)
    s_xy = sum(
        (x - mean_x) * (y - mean_y) for x, y in zip(gold_returns, strategy_returns, strict=True)
    )

    if s_xx == 0.0:
        beta = 0.0
        alpha = mean_y
        r_squared = 0.0
    else:
        beta = s_xy / s_xx
        alpha = mean_y - beta * mean_x
        r_squared = (s_xy**2 / (s_xx * s_yy)) if s_yy > 0.0 else 0.0

    sum_y = sum(strategy_returns)
    sum_x = sum(gold_returns)
    gold_explained = beta * sum_x

    if abs(sum_y) > 1e-9:
        share_gold = gold_explained / sum_y
        share_residual = 1.0 - share_gold
    else:
        share_gold = 0.0
        share_residual = 1.0

    return {
        "status": "ok",
        "days": n,
        "beta": round(beta, 4),
        "alpha_per_day": round(alpha, 6),
        "r_squared": round(r_squared, 4),
        "share_explained_by_gold": round(share_gold, 4),
        "share_explained_by_residual": round(share_residual, 4),
    }


def compute_max_drawdown(daily_pnls: list[Decimal]) -> Decimal:
    """Calculate maximum peak-to-trough drawdown from daily P&L sequence."""
    if not daily_pnls:
        return Decimal("0")

    cumulative = Decimal("0")
    peak = Decimal("0")
    max_dd = Decimal("0")

    for pnl in daily_pnls:
        cumulative += pnl
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_dd:
            max_dd = dd

    return max_dd


def determine_verdict(
    held_out_trade_count: int,
    held_out_days_count: int,
    held_out_net_pnl: Decimal,
    min_trades: int = settings.BACKTEST_MIN_TRADES,
    min_days: int = settings.BACKTEST_MIN_DAYS,
) -> str:
    """Assign verdict based exclusively on held-out performance.

    Options:
    - 'insufficient_data' if fewer than MIN_TRADES or MIN_DAYS
    - 'positive_after_costs_unvalidated' if net_pnl > 0
    - 'no_persistent_edge_after_costs' otherwise
    Never output positive if held-out net P&L is not positive or if insufficient data.
    """
    if held_out_trade_count < min_trades or held_out_days_count < min_days:
        return "insufficient_data"

    if held_out_net_pnl > Decimal("0"):
        return "positive_after_costs_unvalidated"

    return "no_persistent_edge_after_costs"
