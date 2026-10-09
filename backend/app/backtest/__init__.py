"""Stage S9 Backtest module."""

from app.backtest.attribution import (
    compute_attribution,
    compute_max_drawdown,
    determine_verdict,
)
from app.backtest.costs import calculate_leg_cost, get_slippage_bps
from app.backtest.engine import (
    BacktestSimulationResult,
    SimulatedTrade,
    SimulationDailyState,
    run_simulation,
)
from app.backtest.service import execute_backtest
from app.backtest.sizing import LotAllocation, calculate_lot_allocation

__all__ = [
    "BacktestSimulationResult",
    "LotAllocation",
    "SimulatedTrade",
    "SimulationDailyState",
    "calculate_leg_cost",
    "calculate_lot_allocation",
    "compute_attribution",
    "compute_max_drawdown",
    "determine_verdict",
    "execute_backtest",
    "get_slippage_bps",
    "run_simulation",
]
