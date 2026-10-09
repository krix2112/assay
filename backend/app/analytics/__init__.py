"""Analytics module for Assay (S7 spreads, S8 parity)."""

from app.analytics.pairing import (
    ContractQuote,
    PairedSpread,
    determine_weaker_liquidity,
    pair_contracts_for_date,
)
from app.analytics.parity import (
    ParityCalculationResult,
    calculate_parity_score,
    compute_parity,
)
from app.analytics.spreads import (
    RollingStats,
    calculate_rolling_stats,
    compute_mad,
    compute_median,
    compute_spreads,
)

__all__ = [
    "ContractQuote",
    "PairedSpread",
    "ParityCalculationResult",
    "RollingStats",
    "calculate_parity_score",
    "calculate_rolling_stats",
    "compute_mad",
    "compute_median",
    "compute_parity",
    "compute_spreads",
    "determine_weaker_liquidity",
    "pair_contracts_for_date",
]
