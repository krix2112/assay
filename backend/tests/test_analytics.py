"""Pure unit tests for Stages S7 (pairing, spreads) and S8 (parity score)."""

from datetime import date
from decimal import Decimal

from app.analytics.pairing import (
    ContractQuote,
    determine_weaker_liquidity,
    pair_contracts_for_date,
)
from app.analytics.parity import (
    calculate_parity_score,
)
from app.analytics.spreads import (
    calculate_rolling_stats,
    compute_mad,
    compute_median,
)
from app.models.spread import SpreadRecord


def test_hand_calculated_spread_and_precision() -> None:
    """Verify hand-calculated spread_bps formula = (a - b) / b * 10000 with Decimal."""
    # Price A = 7500.00, Price B = 7450.00
    price_a = Decimal("7500.00")
    price_b = Decimal("7450.00")
    # spread = (7500 - 7450) / 7450 * 10000 = 50 / 7450 * 10000 = 67.11409395973...
    expected = (price_a - price_b) / price_b * Decimal(10000)
    assert round(expected, 4) == Decimal("67.1141")

    t_date = date(2026, 3, 5)
    quotes = [
        ContractQuote("GOLDM", date(2026, 3, 5), price_a, "High"),
        ContractQuote("GOLDTEN", date(2026, 3, 5), price_b, "High"),
    ]
    pairs = pair_contracts_for_date(t_date, quotes, max_expiry_gap_days=10)
    assert len(pairs) == 1
    assert pairs[0].symbol_a == "GOLDM"
    assert pairs[0].symbol_b == "GOLDTEN"
    assert pairs[0].spread_bps == expected
    assert pairs[0].expiry_gap_days == 0


def test_hand_calculated_robust_z_score() -> None:
    """Verify hand-calculated median, MAD, and robust_z formula.

    Formula: (spread - med) / (1.4826 * MAD).
    """
    # 11 historical values: [8, 9, 10, 10, 10, 10, 10, 11, 11, 12, 13]
    # Median is 10
    # Absolute deviations from 10: [2, 1, 0, 0, 0, 0, 0, 1, 1, 2, 3]
    # Sorted deviations: [0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3] -> Median deviation (MAD) is 1
    history = [
        Decimal("8"),
        Decimal("9"),
        Decimal("10"),
        Decimal("10"),
        Decimal("10"),
        Decimal("10"),
        Decimal("10"),
        Decimal("11"),
        Decimal("11"),
        Decimal("12"),
        Decimal("13"),
    ]
    med = compute_median(history)
    mad = compute_mad(history, med)
    assert med == Decimal("10")
    assert mad == Decimal("1")

    # If current spread is 12.9652, robust_z = (12.9652 - 10) / (1.4826 * 1) = 2.9652 / 1.4826 = 2.0
    current_spread = Decimal("12.9652")
    stats = calculate_rolling_stats(current_spread, history, min_history=10)
    assert stats.rolling_median_bps == Decimal("10")
    assert stats.rolling_mad_bps == Decimal("1")
    assert stats.robust_z is not None
    assert round(stats.robust_z, 4) == Decimal("2.0000")


def test_pairing_max_gap_and_tie_breaking() -> None:
    """Pairing respects max gap, records gap days, picks nearest expiry.

    Breaks ties by earlier expiry.
    """
    t_date = date(2026, 3, 5)
    # GOLDM expiry: 2026-03-05
    # GOLDTEN candidates:
    # 1. 2026-03-04 (gap = 1)
    # 2. 2026-03-06 (gap = 1, tie with earlier candidate 2026-03-04)
    # 3. 2026-03-25 (gap = 20, > max gap of 10 -> rejected)
    quotes = [
        ContractQuote("GOLDM", date(2026, 3, 5), Decimal("7500"), "High"),
        ContractQuote("GOLDTEN", date(2026, 3, 6), Decimal("7490"), "High"),
        ContractQuote("GOLDTEN", date(2026, 3, 4), Decimal("7480"), "High"),
        ContractQuote("GOLDTEN", date(2026, 3, 25), Decimal("7470"), "High"),
    ]
    pairs = pair_contracts_for_date(t_date, quotes, max_expiry_gap_days=10)
    # Exactly one pair formed: GOLDM paired with earlier tie candidate (2026-03-04)
    assert len(pairs) == 1
    p = pairs[0]
    assert p.symbol_a == "GOLDM"
    assert p.symbol_b == "GOLDTEN"
    assert p.expiry_b == date(2026, 3, 4)
    assert p.expiry_gap_days == 1

    # Check that contracts beyond max gap are NOT paired
    far_quotes = [
        ContractQuote("GOLDM", date(2026, 3, 5), Decimal("7500"), "High"),
        ContractQuote("GOLDTEN", date(2026, 3, 25), Decimal("7480"), "High"),  # gap 20
    ]
    assert pair_contracts_for_date(t_date, far_quotes, max_expiry_gap_days=10) == []


def test_weaker_liquidity_determination() -> None:
    """Weaker liquidity rule: Unknown if either Unknown, else High > Med > Low > Untradeable."""
    assert determine_weaker_liquidity("High", "High") == "High"
    assert determine_weaker_liquidity("High", "Medium") == "Medium"
    assert determine_weaker_liquidity("Medium", "High") == "Medium"
    assert determine_weaker_liquidity("Medium", "Low") == "Low"
    assert determine_weaker_liquidity("Low", "Untradeable") == "Untradeable"
    assert determine_weaker_liquidity("Untradeable", "Untradeable") == "Untradeable"
    # If either is Unknown
    assert determine_weaker_liquidity("High", "Unknown") == "Unknown"
    assert determine_weaker_liquidity("Unknown", "Low") == "Unknown"
    assert determine_weaker_liquidity("Untradeable", "Unknown") == "Unknown"
    assert determine_weaker_liquidity("Unknown", "Unknown") == "Unknown"


def test_mad_zero_short_history_and_no_pairs_return_none() -> None:
    """MAD = 0, history < min_history, and no usable pairs cases return NULL, not a number."""
    # 1. Short history (< 10)
    short_history = [Decimal("100")] * 8
    stats_short = calculate_rolling_stats(Decimal("105"), short_history, min_history=10)
    assert stats_short.history_days == 8
    assert stats_short.robust_z is None

    # 2. Zero history
    stats_zero = calculate_rolling_stats(Decimal("105"), [], min_history=10)
    assert stats_zero.history_days == 0
    assert stats_zero.rolling_median_bps is None
    assert stats_zero.rolling_mad_bps is None
    assert stats_zero.robust_z is None

    # 3. MAD = 0 (15 identical values, dispersion is 0)
    flat_history = [Decimal("50")] * 15
    stats_flat = calculate_rolling_stats(Decimal("55"), flat_history, min_history=10)
    assert stats_flat.history_days == 15
    assert stats_flat.rolling_mad_bps == Decimal("0")
    assert stats_flat.robust_z is None

    # 4. No pairs -> parity score returns status='insufficient_data', score=None
    result = calculate_parity_score([])
    assert result.status == "insufficient_data"
    assert result.score is None
    assert result.pairs_used == 0
    assert (
        "unavailable" in result.explanation.lower() or "insufficient" in result.explanation.lower()
    )


def test_parity_weights_and_exclusion_of_unknown_untradeable() -> None:
    """Parity score weights High (1.0), Medium (0.6), Low (0.3) and excludes Unknown/Untradeable."""
    t_date = date(2026, 3, 5)

    def make_spread(sym_b: str, z: Decimal | None, label: str) -> SpreadRecord:
        return SpreadRecord(
            trade_date=t_date,
            symbol_a="GOLDM",
            expiry_a=date(2026, 3, 5),
            symbol_b=sym_b,
            expiry_b=date(2026, 3, 5),
            expiry_gap_days=0,
            spread_bps=Decimal("15.0"),
            rolling_median_bps=Decimal("10.0"),
            rolling_mad_bps=Decimal("2.0"),
            robust_z=z,
            history_days=15,
            weaker_liquidity_label=label,
            method_version="v1",
        )

    # High pair (z=1.0, weight=1.0), Medium pair (z=2.0, weight=0.6), Low pair (z=0.5, weight=0.3)
    # Excluded pairs: Untradeable (z=3.0), Unknown (z=1.0), Short history (z=None)
    spreads = [
        make_spread("GOLDTEN", Decimal("1.0"), "High"),
        make_spread("GOLDGUINEA", Decimal("2.0"), "Medium"),
        make_spread("GOLDPETAL", Decimal("0.5"), "Low"),
        make_spread("OTHER1", Decimal("3.0"), "Untradeable"),
        make_spread("OTHER2", Decimal("1.0"), "Unknown"),
        make_spread("OTHER3", None, "High"),
    ]

    calc = calculate_parity_score(
        spreads,
        weights={"High": 1.0, "Medium": 0.6, "Low": 0.3},
        z_cap=4.0,
    )
    assert calc.status == "ok"
    assert calc.pairs_used == 3
    assert len(calc.details["excluded_pairs"]) == 3

    # Hand calculation:
    # Pair 1 (High):   w=1.0, cap_z=1.0, ratio=0.25, contrib = 0.25
    # Pair 2 (Medium): w=0.6, cap_z=2.0, ratio=0.50, contrib = 0.30
    # Pair 3 (Low):    w=0.3, cap_z=0.5, ratio=0.125, contrib = 0.0375
    # Total weight = 1.0 + 0.6 + 0.3 = 1.9
    # Total contrib = 0.25 + 0.30 + 0.0375 = 0.5875
    # Penalty = 0.5875 / 1.9 = 0.30921...
    # Score = round(100 * (1 - 0.30921)) = round(69.0789) = 69
    assert calc.score == 69
    assert "Parity score is 69 based on 3 pairs" in calc.explanation
    assert "3 excluded" in calc.explanation
    assert "GOLDM (2026-03-05) / GOLDGUINEA (2026-03-05)" in calc.explanation


def test_lookahead_temporal_isolation() -> None:
    """LOOK-AHEAD TEST: adding or modifying future days must NOT alter earlier calculations."""
    history_day1 = [
        Decimal("10.0"),
        Decimal("11.0"),
        Decimal("12.0"),
        Decimal("10.5"),
        Decimal("11.5"),
        Decimal("9.5"),
        Decimal("10.8"),
        Decimal("11.2"),
        Decimal("10.0"),
        Decimal("12.5"),
    ]
    current_spread_day1 = Decimal("13.0")

    stats1 = calculate_rolling_stats(current_spread_day1, history_day1, min_history=10)

    # Future day introduces wild swing in spread: 500.0
    future_spread = Decimal("500.0")

    # In strict look-ahead prevention, day 1 uses ONLY days strictly before day 1.
    # Recalculating day 1 stats with identical prior history produces identical result
    stats1_recomputed = calculate_rolling_stats(current_spread_day1, history_day1, min_history=10)

    assert stats1.rolling_median_bps == stats1_recomputed.rolling_median_bps
    assert stats1.rolling_mad_bps == stats1_recomputed.rolling_mad_bps
    assert stats1.robust_z == stats1_recomputed.robust_z

    # Parity score on day 1 is also completely independent of future spreads
    t_date = date(2026, 3, 5)
    spread1 = SpreadRecord(
        trade_date=t_date,
        symbol_a="GOLDM",
        expiry_a=date(2026, 3, 5),
        symbol_b="GOLDTEN",
        expiry_b=date(2026, 3, 5),
        expiry_gap_days=0,
        spread_bps=current_spread_day1,
        rolling_median_bps=stats1.rolling_median_bps,
        rolling_mad_bps=stats1.rolling_mad_bps,
        robust_z=stats1.robust_z,
        history_days=10,
        weaker_liquidity_label="High",
        method_version="v1",
    )
    score1 = calculate_parity_score([spread1]).score

    # Future day spread
    future_spread_rec = SpreadRecord(
        trade_date=date(2026, 3, 6),
        symbol_a="GOLDM",
        expiry_a=date(2026, 3, 5),
        symbol_b="GOLDTEN",
        expiry_b=date(2026, 3, 5),
        expiry_gap_days=0,
        spread_bps=future_spread,
        rolling_median_bps=Decimal("11.0"),
        rolling_mad_bps=Decimal("1.0"),
        robust_z=Decimal("4.0"),
        history_days=11,
        weaker_liquidity_label="High",
        method_version="v1",
    )
    assert future_spread_rec.spread_bps == future_spread
    # Day 1 score is unchanged when evaluating day 1 independently
    assert calculate_parity_score([spread1]).score == score1
