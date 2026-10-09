"""Stage S6: Liquidity confidence scoring module."""

import statistics
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.liquidity import LiquidityScoreRecord


@dataclass(frozen=True)
class LiquidityScore:
    """Immutable liquidity metrics for a contract expiry row."""

    symbol: str
    expiry_date: date
    trade_date: date
    volume: int
    open_interest: int
    volume_ratio: Decimal | None
    oi_ratio: Decimal | None
    days_to_expiry: int
    history_days: int
    label: str
    reason: str


def score_liquidity(
    symbol: str,
    expiry_date: date,
    trade_date: date,
    volume: int,
    open_interest: int,
    prior_volumes: list[int],
    prior_ois: list[int],
    min_history_days: int | None = None,
    high_threshold: float | None = None,
    medium_threshold: float | None = None,
    low_threshold: float | None = None,
) -> LiquidityScore:
    """Pure function calculating liquidity confidence score from historical contract series.

    Thresholds are judgement parameters, not validated against real fills.
    Volume is not market depth; the label means informational vs plausibly
    tradeable, not a guarantee of execution.
    """
    min_history = (
        min_history_days if min_history_days is not None else settings.LIQUIDITY_MIN_HISTORY_DAYS
    )
    th_high = Decimal(
        str(high_threshold if high_threshold is not None else settings.LIQUIDITY_HIGH_THRESHOLD)
    )
    th_med = Decimal(
        str(
            medium_threshold
            if medium_threshold is not None
            else settings.LIQUIDITY_MEDIUM_THRESHOLD
        )
    )
    th_low = Decimal(
        str(low_threshold if low_threshold is not None else settings.LIQUIDITY_LOW_THRESHOLD)
    )

    days_to_expiry = (expiry_date - trade_date).days
    history_days = len(prior_volumes)

    # 1. Insufficient history check
    if history_days < min_history:
        return LiquidityScore(
            symbol=symbol,
            expiry_date=expiry_date,
            trade_date=trade_date,
            volume=volume,
            open_interest=open_interest,
            volume_ratio=None,
            oi_ratio=None,
            days_to_expiry=days_to_expiry,
            history_days=history_days,
            label="Unknown",
            reason="insufficient history",
        )

    # 2. Historical median computation
    median_vol = statistics.median(prior_volumes)
    median_oi = statistics.median(prior_ois)

    # 3. Division by zero check on historical baselines
    if median_vol <= 0 or median_oi <= 0:
        return LiquidityScore(
            symbol=symbol,
            expiry_date=expiry_date,
            trade_date=trade_date,
            volume=volume,
            open_interest=open_interest,
            volume_ratio=None,
            oi_ratio=None,
            days_to_expiry=days_to_expiry,
            history_days=history_days,
            label="Unknown",
            reason="no baseline activity",
        )

    # 4. Compute ratios using Decimal
    vol_ratio = Decimal(str(volume)) / Decimal(str(median_vol))
    oi_ratio = Decimal(str(open_interest)) / Decimal(str(median_oi))

    # 5. Evaluate liquidity label
    if volume == 0:
        label = "Untradeable"
        reason = "zero volume recorded"
    elif vol_ratio >= th_high and oi_ratio >= th_high:
        label = "High"
        reason = f"volume ratio ({vol_ratio:.2f}) and oi ratio ({oi_ratio:.2f}) meet high threshold"
    elif vol_ratio >= th_med and oi_ratio >= th_med:
        label = "Medium"
        reason = (
            f"volume ratio ({vol_ratio:.2f}) and oi ratio ({oi_ratio:.2f}) meet medium threshold"
        )
    elif vol_ratio >= th_low and oi_ratio >= th_low and volume > 0:
        label = "Low"
        reason = f"volume ratio ({vol_ratio:.2f}) and oi ratio ({oi_ratio:.2f}) meet low threshold"
    else:
        label = "Untradeable"
        reason = (
            f"activity below minimum threshold (vol ratio={vol_ratio:.2f}, oi ratio={oi_ratio:.2f})"
        )

    # 6. Expiry-proximity downgrade (days_to_expiry <= 2)
    # Applies ONLY to High, Medium, and Low. Never changes Unknown or Untradeable.
    if days_to_expiry <= 2:
        if label == "High":
            label = "Medium"
            reason += " (downgraded: days to expiry <= 2)"
        elif label == "Medium":
            label = "Low"
            reason += " (downgraded: days to expiry <= 2)"
        elif label == "Low":
            label = "Untradeable"
            reason += " (downgraded: days to expiry <= 2)"

    return LiquidityScore(
        symbol=symbol,
        expiry_date=expiry_date,
        trade_date=trade_date,
        volume=volume,
        open_interest=open_interest,
        volume_ratio=vol_ratio,
        oi_ratio=oi_ratio,
        days_to_expiry=days_to_expiry,
        history_days=history_days,
        label=label,
        reason=reason,
    )


def compute_liquidity(
    session: Session,
    date_from: date | None = None,
    date_to: date | None = None,
    lookback_window: int | None = None,
) -> int:
    """Compute and persist liquidity scores idempotently across dates without look-ahead.

    For each target row (symbol, expiry_date, trade_date), history is gathered
    strictly from trading dates < trade_date.
    """
    n_lookback = (
        lookback_window if lookback_window is not None else settings.LIQUIDITY_LOOKBACK_DAYS
    )

    # 1. Fetch all candidate rows ordered chronologically
    # Load all bhavcopy rows to build history for target dates
    all_rows = session.scalars(
        select(BhavcopyRowRecord).order_by(
            BhavcopyRowRecord.symbol,
            BhavcopyRowRecord.expiry_date,
            BhavcopyRowRecord.trade_date,
        )
    ).all()

    if not all_rows:
        return 0

    # Group by contract key (symbol, expiry_date)
    series_by_contract: dict[tuple[str, date], list[BhavcopyRowRecord]] = {}
    for r in all_rows:
        series_by_contract.setdefault((r.symbol, r.expiry_date), []).append(r)

    now_utc = datetime.now(UTC)
    written_count = 0

    for (sym, exp), contract_history in series_by_contract.items():
        # Iterate through chronologically ordered records
        for i, current_row in enumerate(contract_history):
            t_date = current_row.trade_date

            # Filter if date range requested
            if date_from and t_date < date_from:
                continue
            if date_to and t_date > date_to:
                continue

            # Prior window: strictly days before current day, limited to lookback N
            prior_slice = contract_history[max(0, i - n_lookback) : i]
            prior_vols = [p.volume for p in prior_slice]
            prior_ois = [p.open_interest for p in prior_slice]

            score = score_liquidity(
                symbol=sym,
                expiry_date=exp,
                trade_date=t_date,
                volume=current_row.volume,
                open_interest=current_row.open_interest,
                prior_volumes=prior_vols,
                prior_ois=prior_ois,
            )

            # Upsert into liquidity_scores table
            existing = session.get(
                LiquidityScoreRecord,
                (sym, exp, t_date),
            )

            if existing is None:
                new_rec = LiquidityScoreRecord(
                    symbol=sym,
                    expiry_date=exp,
                    trade_date=t_date,
                    volume=score.volume,
                    open_interest=score.open_interest,
                    volume_ratio=score.volume_ratio,
                    oi_ratio=score.oi_ratio,
                    days_to_expiry=score.days_to_expiry,
                    history_days=score.history_days,
                    label=score.label,
                    reason=score.reason,
                    computed_at=now_utc,
                )
                session.add(new_rec)
            else:
                existing.volume = score.volume
                existing.open_interest = score.open_interest
                existing.volume_ratio = score.volume_ratio
                existing.oi_ratio = score.oi_ratio
                existing.days_to_expiry = score.days_to_expiry
                existing.history_days = score.history_days
                existing.label = score.label
                existing.reason = score.reason
                existing.computed_at = now_utc

            written_count += 1

    session.flush()
    logger.info("Liquidity confidence scores computed", count=written_count)
    return written_count
