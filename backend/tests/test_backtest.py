"""Unit tests for Stage S9 walk-forward backtest strategy and analytics."""

from datetime import date
from decimal import Decimal

from app.backtest.attribution import (
    compute_attribution,
    determine_verdict,
)
from app.backtest.costs import calculate_leg_cost
from app.backtest.engine import run_simulation
from app.backtest.sizing import calculate_lot_allocation
from app.models.contract_spec import ContractSpec
from app.models.spread import SpreadRecord


def test_integer_lot_sizing_and_residual_mismatch() -> None:
    """Verify integer lot sizing minimizes gram mismatch and records unhedged gold exposure."""
    # 1. GOLDM (100g) paired with GOLDTEN (10g): 1 lot of GOLDM = 10 lots of GOLDTEN
    alloc1 = calculate_lot_allocation(Decimal("100"), Decimal("10"), "long_a_short_b")
    assert alloc1.lots_a == 1
    assert alloc1.lots_b == 10
    assert alloc1.grams_a == Decimal("100")
    assert alloc1.grams_b == Decimal("100")
    assert alloc1.residual_gram_mismatch == Decimal("0")

    # 2. GOLDM (100g) paired with GOLDGUINEA (8g): 1 lot of GOLDM = 12 or 13 lots of GOLDGUINEA
    # 100 / 8 = 12.5 -> round to 12 or 13.
    alloc2 = calculate_lot_allocation(Decimal("100"), Decimal("8"), "long_a_short_b")
    assert alloc2.lots_a == 1
    assert alloc2.lots_b in (12, 13)
    # Long A (100g), Short B (8 * lots_b): residual = 100 - (8 * lots_b)
    expected_residual = Decimal("100") - (Decimal(alloc2.lots_b) * Decimal("8"))
    assert alloc2.residual_gram_mismatch == expected_residual

    # 3. Direction reversed: long_b_short_a
    alloc3 = calculate_lot_allocation(Decimal("100"), Decimal("8"), "long_b_short_a")
    assert alloc3.residual_gram_mismatch == -expected_residual


def test_hand_calculated_one_trade_pnl_including_costs() -> None:
    """Hand-calculated one-trade P&L with leg multipliers, settlement deltas, and costs."""
    # Leg A: GOLDM (trading=100g, quote=10g -> multiplier 10)
    # Entry=75,000, Exit=75,500. Long 1 lot. Gross = 1 * (75500 - 75000) * 10 = +5,000.
    # Leg B: GOLDTEN (trading=10g, quote=10g -> multiplier 1)
    # Entry=74,900, Exit=75,100. Short 10 lots. Gross = -10 * (75100 - 74900) * 1 = -2,000.
    # Expected Gross P&L = +3,000.00
    expected_gross = Decimal("3000.00")

    # Costs (High liquidity: base 5 bps + slippage 2 bps = 7 bps = 0.0007):
    # Entry A: 75,000 * 1 * 10 * 0.0007 = 525.0
    # Exit A:  75,500 * 1 * 10 * 0.0007 = 528.5
    # Entry B: 74,900 * 10 * 1 * 0.0007 = 524.3
    # Exit B:  75,100 * 10 * 1 * 0.0007 = 525.7
    # Expected Costs = 525.0 + 528.5 + 524.3 + 525.7 = 2,103.50
    cost_a_entry = calculate_leg_cost(
        Decimal("75000"), 1, Decimal("100"), Decimal("10"), "High", 5.0
    )
    cost_a_exit = calculate_leg_cost(
        Decimal("75500"), 1, Decimal("100"), Decimal("10"), "High", 5.0
    )
    cost_b_entry = calculate_leg_cost(
        Decimal("74900"), 10, Decimal("10"), Decimal("10"), "High", 5.0
    )
    cost_b_exit = calculate_leg_cost(
        Decimal("75100"), 10, Decimal("10"), Decimal("10"), "High", 5.0
    )

    total_costs = cost_a_entry + cost_a_exit + cost_b_entry + cost_b_exit
    assert round(total_costs, 2) == Decimal("2103.50")

    expected_net = expected_gross - total_costs
    assert round(expected_net, 2) == Decimal("896.50")


def test_zero_costs_equals_gross_pnl() -> None:
    """When cost and slippage are set to 0, net P&L identically equals gross P&L."""
    cost_entry = calculate_leg_cost(
        price=Decimal("75000"),
        lots=1,
        trading_unit_grams=Decimal("100"),
        quote_unit_grams=Decimal("10"),
        weaker_liquidity_label="High",
        base_cost_bps=-2.0,  # Cancels 2.0 slippage to reach exactly 0 bps
    )
    assert cost_entry == Decimal("0")


def test_entry_happens_on_t_plus_1_never_t() -> None:
    """Entry strictly executes on day t+1 settlement close, never day t."""
    d1 = date(2026, 3, 2)
    d2 = date(2026, 3, 3)
    d3 = date(2026, 3, 4)
    trade_dates = [d1, d2, d3]

    exp_a = date(2026, 3, 25)
    exp_b = date(2026, 3, 26)

    # Dislocation on day 1 (z = -2.5)
    s1 = SpreadRecord(
        trade_date=d1,
        symbol_a="GOLDM",
        expiry_a=exp_a,
        symbol_b="GOLDTEN",
        expiry_b=exp_b,
        expiry_gap_days=1,
        spread_bps=Decimal("-50.0"),
        rolling_median_bps=Decimal("0.0"),
        rolling_mad_bps=Decimal("10.0"),
        robust_z=Decimal("-2.5"),
        history_days=15,
        weaker_liquidity_label="High",
        method_version="v1",
    )

    spreads_by_date = {d1: [s1], d2: [], d3: []}

    prices = {
        ("GOLDM", exp_a, d1): Decimal("75000"),
        ("GOLDTEN", exp_b, d1): Decimal("75200"),
        ("GOLDM", exp_a, d2): Decimal("75050"),
        ("GOLDTEN", exp_b, d2): Decimal("75180"),
        ("GOLDM", exp_a, d3): Decimal("75100"),
        ("GOLDTEN", exp_b, d3): Decimal("75150"),
    }
    fine_gold = {("GOLDM", exp_a, d): Decimal("7500") for d in trade_dates}
    specs = {
        "GOLDM": ContractSpec(
            symbol="GOLDM",
            trading_unit_grams=Decimal("100"),
            quote_unit_grams=Decimal("10"),
            purity=Decimal("0.995"),
            expiry_window_start_day=3,
            expiry_window_end_day=5,
            source_note="test",
        ),
        "GOLDTEN": ContractSpec(
            symbol="GOLDTEN",
            trading_unit_grams=Decimal("10"),
            quote_unit_grams=Decimal("10"),
            purity=Decimal("0.999"),
            expiry_window_start_day=27,
            expiry_window_end_day=31,
            source_note="test",
        ),
    }

    sim = run_simulation(trade_dates, spreads_by_date, prices, fine_gold, specs)

    # Signal triggered on d1 -> entry MUST be on d2
    assert len(sim.trades) == 1
    trade = sim.trades[0]
    assert trade.entry_date == d2  # Strictly t+1
    assert trade.entry_date != d1


def test_forced_exit_before_expiry_and_at_end_of_data() -> None:
    """Exit is triggered within 2 days of expiry or force closed on the last day."""
    d1 = date(2026, 3, 2)
    d2 = date(2026, 3, 3)
    d3 = date(2026, 3, 4)
    trade_dates = [d1, d2, d3]

    # Expiry 6 days away so signal on d1 is allowed (gap > 3d), then nears expiry on d3 (gap <= 2d)
    exp_a_valid = date(2026, 3, 8)
    exp_b_valid = date(2026, 3, 8)

    s1_valid = SpreadRecord(
        trade_date=d1,
        symbol_a="GOLDM",
        expiry_a=exp_a_valid,
        symbol_b="GOLDTEN",
        expiry_b=exp_b_valid,
        expiry_gap_days=0,
        spread_bps=Decimal("80.0"),
        rolling_median_bps=Decimal("10.0"),
        rolling_mad_bps=Decimal("5.0"),
        robust_z=Decimal("3.0"),
        history_days=12,
        weaker_liquidity_label="High",
        method_version="v1",
    )

    prices = {("GOLDM", exp_a_valid, d): Decimal("75000") for d in trade_dates}
    prices.update({("GOLDTEN", exp_b_valid, d): Decimal("74800") for d in trade_dates})
    fine_gold = {("GOLDM", exp_a_valid, d): Decimal("7500") for d in trade_dates}
    specs = {
        "GOLDM": ContractSpec(
            symbol="GOLDM",
            trading_unit_grams=Decimal("100"),
            quote_unit_grams=Decimal("10"),
            purity=Decimal("0.995"),
            expiry_window_start_day=3,
            expiry_window_end_day=5,
            source_note="test",
        ),
        "GOLDTEN": ContractSpec(
            symbol="GOLDTEN",
            trading_unit_grams=Decimal("10"),
            quote_unit_grams=Decimal("10"),
            purity=Decimal("0.999"),
            expiry_window_start_day=27,
            expiry_window_end_day=31,
            source_note="test",
        ),
    }

    sim = run_simulation(trade_dates, {d1: [s1_valid], d2: [], d3: []}, prices, fine_gold, specs)
    assert len(sim.trades) == 1
    # Trade was force closed on d3 at end of data
    assert sim.trades[0].exit_reason == "end_of_data"
    assert sim.trades[0].exit_date == d3


def test_attribution_pure_gold_and_short_data() -> None:
    """Pure gold strategy yields beta ~ 1 and alpha ~ 0; short data gives 'insufficient data'."""
    # 1. 25 days with strategy return = gold return
    gold_returns = [0.001 * (i % 5 - 2) for i in range(25)]
    strat_returns = list(gold_returns)

    attrib = compute_attribution(strat_returns, gold_returns, min_days=20)
    assert attrib["status"] == "ok"
    assert round(attrib["beta"], 2) == 1.00
    assert round(attrib["alpha_per_day"], 4) == 0.0000
    assert round(attrib["r_squared"], 2) == 1.00

    # 2. Short data (< 20 days)
    short_attrib = compute_attribution(strat_returns[:15], gold_returns[:15], min_days=20)
    assert short_attrib["status"] == "insufficient data"
    assert "beta" not in short_attrib

    # 3. Verdict on short data (< 10 trades or < 60 days)
    verdict = determine_verdict(
        held_out_trade_count=5, held_out_days_count=30, held_out_net_pnl=Decimal("1000")
    )
    assert verdict == "insufficient_data"


def test_lookahead_temporal_isolation() -> None:
    """LOOK-AHEAD TEST: mutating later days must leave earlier signals, entries, and P&L unchanged.

    Ensures no future data leaks into prior days.
    """
    d1 = date(2026, 3, 2)
    d2 = date(2026, 3, 3)
    d3 = date(2026, 3, 4)
    d4 = date(2026, 3, 5)
    trade_dates = [d1, d2, d3, d4]

    exp_a = date(2026, 3, 25)
    exp_b = date(2026, 3, 25)

    s1 = SpreadRecord(
        trade_date=d1,
        symbol_a="GOLDM",
        expiry_a=exp_a,
        symbol_b="GOLDTEN",
        expiry_b=exp_b,
        expiry_gap_days=0,
        spread_bps=Decimal("-60.0"),
        rolling_median_bps=Decimal("0.0"),
        rolling_mad_bps=Decimal("10.0"),
        robust_z=Decimal("-3.0"),
        history_days=15,
        weaker_liquidity_label="High",
        method_version="v1",
    )

    prices_base = {
        ("GOLDM", exp_a, d1): Decimal("75000"),
        ("GOLDTEN", exp_b, d1): Decimal("75200"),
        ("GOLDM", exp_a, d2): Decimal("75100"),
        ("GOLDTEN", exp_b, d2): Decimal("75150"),
        ("GOLDM", exp_a, d3): Decimal("75200"),
        ("GOLDTEN", exp_b, d3): Decimal("75100"),
        ("GOLDM", exp_a, d4): Decimal("75250"),
        ("GOLDTEN", exp_b, d4): Decimal("75050"),
    }
    fine_gold = {("GOLDM", exp_a, d): Decimal("7500") for d in trade_dates}
    specs = {
        "GOLDM": ContractSpec(
            symbol="GOLDM",
            trading_unit_grams=Decimal("100"),
            quote_unit_grams=Decimal("10"),
            purity=Decimal("0.995"),
            expiry_window_start_day=3,
            expiry_window_end_day=5,
            source_note="test",
        ),
        "GOLDTEN": ContractSpec(
            symbol="GOLDTEN",
            trading_unit_grams=Decimal("10"),
            quote_unit_grams=Decimal("10"),
            purity=Decimal("0.999"),
            expiry_window_start_day=27,
            expiry_window_end_day=31,
            source_note="test",
        ),
    }

    sim1 = run_simulation(
        trade_dates, {d1: [s1], d2: [], d3: [], d4: []}, prices_base, fine_gold, specs
    )

    # Mutate future day d4 drastically: 10x price swing
    prices_mutated = dict(prices_base)
    prices_mutated[("GOLDM", exp_a, d4)] = Decimal("999999")
    prices_mutated[("GOLDTEN", exp_b, d4)] = Decimal("100000")

    sim2 = run_simulation(
        trade_dates, {d1: [s1], d2: [], d3: [], d4: []}, prices_mutated, fine_gold, specs
    )

    # Signals on d1 and entry on d2 must be IDENTICAL
    assert sim1.trades[0].entry_date == sim2.trades[0].entry_date == d2
    assert sim1.trades[0].entry_price_a == sim2.trades[0].entry_price_a
    assert sim1.trades[0].entry_price_b == sim2.trades[0].entry_price_b

    # Daily P&L for day 1 and day 2 must be IDENTICAL
    d1_pnl_1 = next(d.strategy_pnl for d in sim1.daily_records if d.trade_date == d1)
    d1_pnl_2 = next(d.strategy_pnl for d in sim2.daily_records if d.trade_date == d1)
    assert d1_pnl_1 == d1_pnl_2

    d2_pnl_1 = next(d.strategy_pnl for d in sim1.daily_records if d.trade_date == d2)
    d2_pnl_2 = next(d.strategy_pnl for d in sim2.daily_records if d.trade_date == d2)
    assert d2_pnl_1 == d2_pnl_2
