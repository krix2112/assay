"""Stage S9: Contract lot sizing and unhedged residual exposure logic."""

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class LotAllocation:
    """Integer lot sizing and unhedged gold exposure in grams."""

    lots_a: int
    lots_b: int
    grams_a: Decimal
    grams_b: Decimal
    residual_gram_mismatch: Decimal


def calculate_lot_allocation(
    unit_grams_a: Decimal,
    unit_grams_b: Decimal,
    direction: str,
) -> LotAllocation:
    """Calculate integer lots to equalize gram exposure as closely as possible.

    Record residual gram mismatch (unhedged gold exposure) = long_grams - short_grams.
    direction is 'long_a_short_b' or 'long_b_short_a'.
    """
    if unit_grams_a <= Decimal("0") or unit_grams_b <= Decimal("0"):
        raise ValueError("Contract trading units must be positive")

    # Set 1 lot of the larger contract and scale the smaller
    if unit_grams_a >= unit_grams_b:
        lots_a = 1
        scaled_b = round(unit_grams_a / unit_grams_b)
        lots_b = max(1, int(scaled_b))
    else:
        lots_b = 1
        scaled_a = round(unit_grams_b / unit_grams_a)
        lots_a = max(1, int(scaled_a))

    grams_a = Decimal(lots_a) * unit_grams_a
    grams_b = Decimal(lots_b) * unit_grams_b

    # Unhedged gold exposure = long_grams - short_grams
    if direction == "long_a_short_b":
        residual = grams_a - grams_b
    else:
        residual = grams_b - grams_a

    return LotAllocation(
        lots_a=lots_a,
        lots_b=lots_b,
        grams_a=grams_a,
        grams_b=grams_b,
        residual_gram_mismatch=residual,
    )
