"""Pairing logic for MCX gold contracts (Stage S7).

Pure functions for pairing contracts across different symbols and computing basis spreads.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

# No carry adjustment in v1; spreads include expiry-date differences.
# Pairing rule is an assumption to verify.
# Never build a continuous near-month series.

LIQUIDITY_RANK = {
    "Untradeable": 0,
    "Low": 1,
    "Medium": 2,
    "High": 3,
}


@dataclass(frozen=True)
class ContractQuote:
    """Normalized contract price and liquidity confidence on a trade date."""

    symbol: str
    expiry_date: date
    fine_gold_price_per_gram: Decimal
    liquidity_label: str


@dataclass(frozen=True)
class PairedSpread:
    """Pair of contracts and their instantaneous spread in basis points."""

    trade_date: date
    symbol_a: str
    expiry_a: date
    symbol_b: str
    expiry_b: date
    expiry_gap_days: int
    spread_bps: Decimal
    weaker_liquidity_label: str


def determine_weaker_liquidity(label_a: str, label_b: str) -> str:
    """Determine the weaker liquidity label between two contracts.

    Order: High > Medium > Low > Untradeable.
    If either contract is 'Unknown', the pair label is 'Unknown'.
    """
    if label_a == "Unknown" or label_b == "Unknown":
        return "Unknown"

    rank_a = LIQUIDITY_RANK.get(label_a, -1)
    rank_b = LIQUIDITY_RANK.get(label_b, -1)

    if rank_a == -1 or rank_b == -1:
        return "Unknown"

    return label_a if rank_a <= rank_b else label_b


def pair_contracts_for_date(
    trade_date: date,
    quotes: list[ContractQuote],
    max_expiry_gap_days: int = 10,
) -> list[PairedSpread]:
    """Pair contracts of different symbols for a given trade date.

    Rule:
    - Compare contracts of DIFFERENT symbols using fine_gold_price_per_gram.
    - Alphabetical symbol ordering: symbol_a < symbol_b.
    - For each contract of symbol_a, pick the contract of symbol_b with
      the smallest expiry gap; on a tie, pick the earlier expiry.
    - Do not create a second pair from b's side.
    - Only allowed if expiry gap <= max_expiry_gap_days.
    - spread_bps = (price_a - price_b) / price_b * 10000 (Decimal).
    - No carry adjustment in v1; spreads include expiry-date differences.
      Pairing rule is an assumption to verify.
    - Never build a continuous near-month series.
    """
    by_symbol: dict[str, list[ContractQuote]] = {}
    for q in quotes:
        by_symbol.setdefault(q.symbol, []).append(q)

    symbols = sorted(by_symbol.keys())
    pairs: list[PairedSpread] = []

    for i in range(len(symbols)):
        for j in range(i + 1, len(symbols)):
            sym_a = symbols[i]
            sym_b = symbols[j]

            quotes_a = by_symbol[sym_a]
            quotes_b = by_symbol[sym_b]

            for qa in quotes_a:
                # Find contract in quotes_b with smallest expiry gap; on tie, pick earlier expiry
                best_qb: ContractQuote | None = None
                best_gap: int | None = None

                for qb in quotes_b:
                    gap = abs((qa.expiry_date - qb.expiry_date).days)
                    if gap > max_expiry_gap_days:
                        continue

                    if best_qb is None or best_gap is None:
                        best_qb = qb
                        best_gap = gap
                    elif gap < best_gap:
                        best_qb = qb
                        best_gap = gap
                    elif gap == best_gap and qb.expiry_date < best_qb.expiry_date:
                        best_qb = qb
                        best_gap = gap

                if best_qb is not None and best_gap is not None:
                    if best_qb.fine_gold_price_per_gram <= Decimal(0):
                        continue

                    # spread_bps = (a - b) / b * 10000
                    spread_bps = (
                        (qa.fine_gold_price_per_gram - best_qb.fine_gold_price_per_gram)
                        / best_qb.fine_gold_price_per_gram
                    ) * Decimal(10000)

                    weaker_label = determine_weaker_liquidity(
                        qa.liquidity_label, best_qb.liquidity_label
                    )

                    pairs.append(
                        PairedSpread(
                            trade_date=trade_date,
                            symbol_a=qa.symbol,
                            expiry_a=qa.expiry_date,
                            symbol_b=best_qb.symbol,
                            expiry_b=best_qb.expiry_date,
                            expiry_gap_days=best_gap,
                            spread_bps=spread_bps,
                            weaker_liquidity_label=weaker_label,
                        )
                    )

    return pairs
