"""Stage S9: Transaction cost and slippage estimation."""

from decimal import Decimal

from app.core.config import settings

# Cost figures are placeholders, NOT verified brokerage, exchange or tax rates.
# Replace with real figures before drawing conclusions.


def get_slippage_bps(weaker_liquidity_label: str) -> float:
    """Return placeholder slippage bps based on weaker liquidity label."""
    if weaker_liquidity_label == "High":
        return settings.BACKTEST_SLIPPAGE_HIGH_BPS
    elif weaker_liquidity_label == "Medium":
        return settings.BACKTEST_SLIPPAGE_MEDIUM_BPS
    elif weaker_liquidity_label == "Low":
        return settings.BACKTEST_SLIPPAGE_LOW_BPS
    else:
        # Untradeable or Unknown fallback
        return settings.BACKTEST_SLIPPAGE_LOW_BPS


def calculate_leg_cost(
    price: Decimal,
    lots: int,
    trading_unit_grams: Decimal,
    quote_unit_grams: Decimal,
    weaker_liquidity_label: str,
    base_cost_bps: float = settings.BACKTEST_COST_BPS_PER_SIDE,
) -> Decimal:
    """Calculate transaction and slippage cost for one leg on entry or exit.

    Cost = notional * (base_cost_bps + slippage_bps) / 10000.
    # Cost figures are placeholders, NOT verified brokerage, exchange or tax rates.
    # Replace with real figures before drawing conclusions.
    """
    if quote_unit_grams <= Decimal("0"):
        raise ValueError("Quote unit grams must be positive")

    multiplier = trading_unit_grams / quote_unit_grams
    notional = price * Decimal(lots) * multiplier

    slippage_bps = get_slippage_bps(weaker_liquidity_label)
    total_bps = Decimal(str(base_cost_bps + slippage_bps))

    return notional * (total_bps / Decimal("10000"))
