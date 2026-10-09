"""Stage S7: Spreads computation module.

Calculates contract pairs, instantaneous basis spreads, rolling median and MAD,
and robust z-scores.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session

from app.analytics.pairing import (
    ContractQuote,
    pair_contracts_for_date,
)
from app.core.config import settings
from app.models.liquidity import LiquidityScoreRecord
from app.models.normalized_price import NormalizedPriceRecord
from app.models.spread import SpreadRecord


def compute_median(values: Sequence[Decimal]) -> Decimal:
    """Compute exact median of Decimal values."""
    if not values:
        raise ValueError("Cannot compute median of empty sequence")
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n % 2 == 1:
        return sorted_vals[n // 2]
    return (sorted_vals[n // 2 - 1] + sorted_vals[n // 2]) / Decimal(2)


def compute_mad(values: Sequence[Decimal], median_val: Decimal) -> Decimal:
    """Compute Median Absolute Deviation (MAD) of Decimal values."""
    if not values:
        raise ValueError("Cannot compute MAD of empty sequence")
    devs = [abs(v - median_val) for v in values]
    return compute_median(devs)


@dataclass(frozen=True)
class RollingStats:
    """Calculated rolling statistics for a spread pair."""

    history_days: int
    rolling_median_bps: Decimal | None
    rolling_mad_bps: Decimal | None
    robust_z: Decimal | None


def calculate_rolling_stats(
    current_spread_bps: Decimal,
    historical_spreads: Sequence[Decimal],
    min_history: int = 10,
) -> RollingStats:
    """Calculate rolling median, MAD, and robust z-score over prior days.

    Uses ONLY days strictly before the current day.
    robust_z = (spread - median) / (1.4826 * MAD).
    If history_days < min_history or MAD is 0, robust_z = NULL.
    """
    history_days = len(historical_spreads)
    if history_days == 0:
        return RollingStats(
            history_days=0,
            rolling_median_bps=None,
            rolling_mad_bps=None,
            robust_z=None,
        )

    median_val = compute_median(historical_spreads)
    mad_val = compute_mad(historical_spreads, median_val)

    if history_days < min_history or mad_val == Decimal(0):
        robust_z = None
    else:
        scale = Decimal("1.4826") * mad_val
        robust_z = (current_spread_bps - median_val) / scale

    return RollingStats(
        history_days=history_days,
        rolling_median_bps=median_val,
        rolling_mad_bps=mad_val,
        robust_z=robust_z,
    )


def compute_spreads(
    session: Session,
    trade_date: date,
    method_version: str = settings.ANALYTICS_METHOD_VERSION,
    commit: bool = True,
) -> list[SpreadRecord]:
    """Compute and persist spreads and rolling stats for trade_date.

    Idempotent: replaces any existing records for the same trade_date and method_version.
    """
    # 1. Fetch normalized prices and liquidity scores for trade_date
    stmt = (
        select(
            NormalizedPriceRecord.symbol,
            NormalizedPriceRecord.expiry_date,
            NormalizedPriceRecord.fine_gold_price_per_gram,
            LiquidityScoreRecord.label.label("liquidity_label"),
        )
        .outerjoin(
            LiquidityScoreRecord,
            and_(
                LiquidityScoreRecord.symbol == NormalizedPriceRecord.symbol,
                LiquidityScoreRecord.expiry_date == NormalizedPriceRecord.expiry_date,
                LiquidityScoreRecord.trade_date == NormalizedPriceRecord.trade_date,
            ),
        )
        .where(NormalizedPriceRecord.trade_date == trade_date)
    )
    rows = session.execute(stmt).all()

    quotes = [
        ContractQuote(
            symbol=r.symbol,
            expiry_date=r.expiry_date,
            fine_gold_price_per_gram=r.fine_gold_price_per_gram,
            liquidity_label=r.liquidity_label or "Unknown",
        )
        for r in rows
    ]

    # 2. Pair contracts
    paired = pair_contracts_for_date(
        trade_date=trade_date,
        quotes=quotes,
        max_expiry_gap_days=settings.PAIR_MAX_EXPIRY_GAP_DAYS,
    )

    records: list[SpreadRecord] = []

    # 3. For each pair, fetch history strictly before trade_date
    for p in paired:
        hist_stmt = (
            select(SpreadRecord.spread_bps)
            .where(
                SpreadRecord.symbol_a == p.symbol_a,
                SpreadRecord.expiry_a == p.expiry_a,
                SpreadRecord.symbol_b == p.symbol_b,
                SpreadRecord.expiry_b == p.expiry_b,
                SpreadRecord.trade_date < trade_date,
                SpreadRecord.method_version == method_version,
            )
            .order_by(SpreadRecord.trade_date.desc())
            .limit(settings.SPREAD_LOOKBACK_DAYS)
        )
        hist_spreads = list(session.execute(hist_stmt).scalars().all())

        stats = calculate_rolling_stats(
            current_spread_bps=p.spread_bps,
            historical_spreads=hist_spreads,
            min_history=settings.SPREAD_MIN_HISTORY,
        )

        record = SpreadRecord(
            trade_date=trade_date,
            symbol_a=p.symbol_a,
            expiry_a=p.expiry_a,
            symbol_b=p.symbol_b,
            expiry_b=p.expiry_b,
            expiry_gap_days=p.expiry_gap_days,
            spread_bps=p.spread_bps,
            rolling_median_bps=stats.rolling_median_bps,
            rolling_mad_bps=stats.rolling_mad_bps,
            robust_z=stats.robust_z,
            history_days=stats.history_days,
            weaker_liquidity_label=p.weaker_liquidity_label,
            method_version=method_version,
        )
        records.append(record)

    # 4. Idempotently replace records
    session.execute(
        delete(SpreadRecord).where(
            SpreadRecord.trade_date == trade_date,
            SpreadRecord.method_version == method_version,
        )
    )
    session.add_all(records)
    if commit:
        session.commit()

    return records
