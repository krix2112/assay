"""Pure function to generate plain-text daily Assay briefs."""

from datetime import date
from decimal import Decimal
from typing import Any

DISCLAIMER = "Analytics only, not investment advice."


def build_brief(
    trade_date: date,
    parity: dict[str, Any] | None,
    spreads_summary: list[dict[str, Any]] | None = None,
    calendar_warnings: list[str] | None = None,
    quality_summary: dict[str, Any] | None = None,
    prev_parity: dict[str, Any] | None = None,
) -> str:
    """Build compact daily brief text (<= 900 characters).

    - Line 1: Date and Parity Score (or reason if missing/uncomputed).
    - Line 2: Delta versus previous day score.
    - Pairs to watch: At most 2 pairs with |robust_z| >= 2 and High/Medium liquidity.
    - Warnings: Contracts to avoid (Unknown/Untradeable) and quality/calendar warnings.
    - Quiet mode: If no pairs meet threshold and no data warnings exist, one short line.
    - Closing line: "Analytics only, not investment advice."
    """
    date_str = trade_date.isoformat()

    # 1. No parity row in database
    if parity is None:
        return f"Assay Brief {date_str}: no score today: data is unavailable.\n\n{DISCLAIMER}"

    score = parity.get("score")
    status = parity.get("status")

    # 2. Parity row present but score is None or status indicates no score
    if score is None:
        reason = parity.get("reason") or status or "insufficient data"
        lines = [f"Assay Brief {date_str}: no score today: {reason}."]
        if calendar_warnings:
            for w in calendar_warnings:
                lines.append(f"Warning: {w}")
        lines.append(f"\n{DISCLAIMER}")
        return "\n".join(lines)

    score_val = Decimal(str(score))
    lines = [f"Assay Brief {date_str}: Parity Score {score_val:.1f} ({status})."]

    # 3. Change vs previous day
    if prev_parity and prev_parity.get("score") is not None:
        prev_score_val = Decimal(str(prev_parity["score"]))
        delta = score_val - prev_score_val
        lines.append(f"Score change: {delta:+.1f} vs previous day.")
    else:
        lines.append("Score change: no previous day baseline.")

    # 4. Filter watch pairs (|robust_z| >= 2, High or Medium)
    watch_candidates: list[dict[str, Any]] = []
    untradeable_contracts: set[str] = set()

    for item in spreads_summary or []:
        liq = item.get("weaker_liquidity_label")
        if liq in ("Unknown", "Untradeable"):
            if item.get("symbol_a"):
                untradeable_contracts.add(item["symbol_a"])
            if item.get("symbol_b"):
                untradeable_contracts.add(item["symbol_b"])
            continue

        z = item.get("robust_z")
        if z is not None and abs(float(z)) >= 2.0 and liq in ("High", "Medium"):
            watch_candidates.append(item)

    # Sort candidates by |robust_z| descending, select at most 2
    watch_candidates.sort(key=lambda x: abs(float(x.get("robust_z") or 0)), reverse=True)
    selected_pairs = watch_candidates[:2]

    # Collect data warnings
    warnings: list[str] = []
    if calendar_warnings:
        warnings.extend(calendar_warnings)
    if quality_summary:
        for chk, cnt in quality_summary.items():
            if cnt and cnt > 0 and chk in ("DATE_MISMATCH", "MISSING_ROWS"):
                warnings.append(f"Data check '{chk}' flagged {cnt} issue(s)")

    has_warnings = bool(warnings or untradeable_contracts)

    # 5. Quiet mode check
    if not selected_pairs and not has_warnings:
        lines.append("Quiet day: all pairs within normal bounds; nothing needs attention.")
    else:
        if selected_pairs:
            lines.append("Pairs to watch (informational, may not be tradeable):")
            for p in selected_pairs:
                z_flt = float(p["robust_z"])
                sym_pair = f"{p['symbol_a']}/{p['symbol_b']}"
                liq_lbl = p.get("weaker_liquidity_label")
                lines.append(f" - {sym_pair}: z={z_flt:+.2f} ({liq_lbl})")

        if untradeable_contracts:
            avoid_list = ", ".join(sorted(untradeable_contracts))
            lines.append(f"Contracts to avoid comparing today: {avoid_list}")

        if warnings:
            for w in warnings:
                lines.append(f"Data warning: {w}")

    lines.append(f"\n{DISCLAIMER}")
    brief_text = "\n".join(lines)

    # Safety truncate to 900 chars if exceeded
    if len(brief_text) > 900:
        cutoff = 900 - len(f"\n...\n{DISCLAIMER}")
        brief_text = f"{brief_text[:cutoff]}\n...\n{DISCLAIMER}"

    return brief_text
