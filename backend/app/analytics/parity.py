"""Stage S8: Parity score calculation module.

# Parity Score v1 is a draft. It has NOT been validated against known dislocations.
# Weights and cap are judgement parameters.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.parity import ParityScoreRecord
from app.models.spread import SpreadRecord


@dataclass(frozen=True)
class ParityCalculationResult:
    """Result of pure parity score calculation."""

    score: int | None
    status: str
    pairs_used: int
    explanation: str
    details: dict[str, Any]


def calculate_parity_score(
    spreads: list[SpreadRecord],
    weights: dict[str, float] | None = None,
    z_cap: float | None = None,
) -> ParityCalculationResult:
    """Pure function calculating the daily gold market parity score.

    # Parity Score v1 is a draft. It has NOT been validated against known dislocations.
    # Weights and cap are judgement parameters.

    Rules:
    - Use pairs with non-null robust_z whose weaker_liquidity_label is High, Medium, or Low.
    - Exclude Unknown and Untradeable pairs and count them.
    - Exclude pairs where robust_z is NULL (insufficient history or zero MAD).
    - weight: High 1.0, Medium 0.6, Low 0.3.
    - penalty = weighted mean of min(|robust_z|, Z_CAP) / Z_CAP.
    - score = round(100 * (1 - penalty)), clamped 0 to 100.
    - If no usable pairs, status = 'insufficient_data', score NULL, never invent a score.
    - explanation is one plain sentence: score, pairs used, pairs excluded and why,
      largest contributor.
    """
    if weights is None:
        weights = {
            "High": settings.PARITY_WEIGHT_HIGH,
            "Medium": settings.PARITY_WEIGHT_MEDIUM,
            "Low": settings.PARITY_WEIGHT_LOW,
        }
    if z_cap is None:
        z_cap = settings.PARITY_Z_CAP

    usable: list[tuple[SpreadRecord, float, float, float]] = []  # (spread, weight, ratio, contrib)
    excluded: list[tuple[SpreadRecord, str]] = []

    for s in spreads:
        if s.weaker_liquidity_label in ("Unknown", "Untradeable"):
            excluded.append((s, f"unusable liquidity ({s.weaker_liquidity_label})"))
        elif s.robust_z is None:
            excluded.append((s, "insufficient history (< 10 days) or zero MAD"))
        elif s.weaker_liquidity_label not in weights:
            excluded.append((s, f"unrecognized liquidity label ({s.weaker_liquidity_label})"))
        else:
            w = weights[s.weaker_liquidity_label]
            abs_z = abs(float(s.robust_z))
            capped_z = min(abs_z, z_cap)
            ratio = capped_z / z_cap
            contrib = w * ratio
            usable.append((s, w, ratio, contrib))

    # Reasons summary for excluded
    excluded_counts: dict[str, int] = {}
    for _, reason in excluded:
        excluded_counts[reason] = excluded_counts.get(reason, 0) + 1

    if excluded_counts:
        reasons_str = ", ".join(
            f"{cnt} due to {rsn}" for rsn, cnt in sorted(excluded_counts.items())
        )
    else:
        reasons_str = "none"

    if not usable:
        explanation = (
            f"Parity score is unavailable with 0 pairs used "
            f"({len(excluded)} excluded: {reasons_str}) and no valid contributors."
        )
        details: dict[str, Any] = {
            "is_draft": True,
            "z_cap": z_cap,
            "penalty": None,
            "usable_pairs": [],
            "excluded_pairs": [
                {
                    "pair": f"{s.symbol_a}-{s.symbol_b}",
                    "expiry_a": str(s.expiry_a),
                    "expiry_b": str(s.expiry_b),
                    "reason": rsn,
                    "weaker_liquidity_label": s.weaker_liquidity_label,
                    "robust_z": float(s.robust_z) if s.robust_z is not None else None,
                }
                for s, rsn in excluded
            ],
            "largest_contributor": None,
        }
        return ParityCalculationResult(
            score=None,
            status="insufficient_data",
            pairs_used=0,
            explanation=explanation,
            details=details,
        )

    total_weight = sum(w for _, w, _, _ in usable)
    total_weighted_ratio = sum(contrib for _, _, _, contrib in usable)
    penalty = total_weighted_ratio / total_weight if total_weight > 0 else 1.0

    raw_score = round(100.0 * (1.0 - penalty))
    score = max(0, min(100, int(raw_score)))

    # Identify largest contributor: pair with highest penalty contribution (or highest ratio)
    sorted_by_contrib = sorted(
        usable, key=lambda item: (item[3], abs(float(item[0].robust_z or Decimal(0)))), reverse=True
    )
    top_spread, _, _, _ = sorted_by_contrib[0]
    largest_contributor_str = (
        f"{top_spread.symbol_a} ({top_spread.expiry_a}) / "
        f"{top_spread.symbol_b} ({top_spread.expiry_b}) "
        f"[z={float(top_spread.robust_z or Decimal(0)):.2f}]"
    )

    explanation = (
        f"Parity score is {score} based on {len(usable)} pairs "
        f"({len(excluded)} excluded: {reasons_str}), "
        f"with the largest contributor being {largest_contributor_str}."
    )

    details = {
        "is_draft": True,
        "z_cap": z_cap,
        "penalty": round(penalty, 4),
        "usable_pairs": [
            {
                "pair": f"{s.symbol_a}-{s.symbol_b}",
                "symbol_a": s.symbol_a,
                "expiry_a": str(s.expiry_a),
                "symbol_b": s.symbol_b,
                "expiry_b": str(s.expiry_b),
                "spread_bps": float(s.spread_bps),
                "robust_z": float(s.robust_z or Decimal(0)),
                "weaker_liquidity_label": s.weaker_liquidity_label,
                "weight": w,
                "penalty_contribution": round(contrib, 4),
            }
            for s, w, _, contrib in usable
        ],
        "excluded_pairs": [
            {
                "pair": f"{s.symbol_a}-{s.symbol_b}",
                "expiry_a": str(s.expiry_a),
                "expiry_b": str(s.expiry_b),
                "reason": rsn,
                "weaker_liquidity_label": s.weaker_liquidity_label,
                "robust_z": float(s.robust_z) if s.robust_z is not None else None,
            }
            for s, rsn in excluded
        ],
        "largest_contributor": largest_contributor_str,
    }

    return ParityCalculationResult(
        score=score,
        status="ok",
        pairs_used=len(usable),
        explanation=explanation,
        details=details,
    )


def compute_parity(
    session: Session,
    trade_date: date,
    method_version: str = settings.ANALYTICS_METHOD_VERSION,
    commit: bool = True,
) -> ParityScoreRecord:
    """Compute and persist parity score for trade_date.

    Idempotent: replaces any existing parity score record for trade_date.
    """
    stmt = select(SpreadRecord).where(
        SpreadRecord.trade_date == trade_date,
        SpreadRecord.method_version == method_version,
    )
    spreads = list(session.execute(stmt).scalars().all())

    calc = calculate_parity_score(spreads)

    now = datetime.now(UTC)
    record = ParityScoreRecord(
        trade_date=trade_date,
        score=calc.score,
        status=calc.status,
        pairs_used=calc.pairs_used,
        explanation=calc.explanation,
        details=calc.details,
        method_version=method_version,
        computed_at=now,
    )

    session.execute(
        delete(ParityScoreRecord).where(
            ParityScoreRecord.trade_date == trade_date,
        )
    )
    session.add(record)
    if commit:
        session.commit()

    return record
