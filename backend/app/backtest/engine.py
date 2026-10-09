"""Stage S9: Walk-forward backtest simulation engine.

Executes pure simulation over historical contract spreads and settlement prices.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any

from app.backtest.attribution import (
    compute_attribution,
    compute_max_drawdown,
    determine_verdict,
)
from app.backtest.costs import calculate_leg_cost
from app.backtest.sizing import calculate_lot_allocation
from app.core.config import settings
from app.models.contract_spec import ContractSpec
from app.models.spread import SpreadRecord


@dataclass
class SimulatedTrade:
    """Represents a completed or active trade in the simulation."""

    entry_date: date
    exit_date: date | None
    symbol_a: str
    expiry_a: date
    symbol_b: str
    expiry_b: date
    direction: str  # 'long_a_short_b' or 'long_b_short_a'
    lots_a: int
    lots_b: int
    entry_price_a: Decimal
    entry_price_b: Decimal
    entry_spread_bps: Decimal
    exit_price_a: Decimal | None = None
    exit_price_b: Decimal | None = None
    exit_spread_bps: Decimal | None = None
    entry_cost: Decimal = Decimal("0")
    exit_cost: Decimal = Decimal("0")
    gross_pnl: Decimal = Decimal("0")
    costs: Decimal = Decimal("0")
    net_pnl: Decimal = Decimal("0")
    exit_reason: str = ""
    residual_gram_mismatch: Decimal = Decimal("0")
    weaker_liquidity_label: str = "Medium"
    days_held: int = 0
    pending_exit: bool = False
    pending_exit_reason: str = ""
    exit_delay_days: int = 0


@dataclass
class PendingEntryOrder:
    """An entry signal generated on close of day t to execute on day t+1."""

    signal_date: date
    symbol_a: str
    expiry_a: date
    symbol_b: str
    expiry_b: date
    direction: str
    weaker_liquidity_label: str
    signal_spread_bps: Decimal


@dataclass
class SimulationDailyState:
    """Daily portfolio state and P&L record."""

    trade_date: date
    strategy_pnl: Decimal
    gross_pnl: Decimal
    costs: Decimal
    gold_return: Decimal | None
    open_positions: int


@dataclass
class BacktestSimulationResult:
    """Complete output of a backtest simulation run."""

    data_from: date
    data_to: date
    train_to: date
    params: dict[str, Any]
    daily_records: list[SimulationDailyState]
    trades: list[SimulatedTrade]
    summary: dict[str, Any]
    skipped_signals: list[dict[str, Any]] = field(default_factory=list)


def run_simulation(
    trade_dates: list[date],
    spreads_by_date: dict[date, list[SpreadRecord]],
    prices_by_contract_and_date: dict[tuple[str, date, date], Decimal],
    fine_gold_by_contract_and_date: dict[tuple[str, date, date], Decimal],
    specs_by_symbol: dict[str, ContractSpec],
    params: dict[str, Any] | None = None,
) -> BacktestSimulationResult:
    """Execute pure walk-forward backtest across sorted trade dates.

    Strategy Rules:
    - Signal at close of day t using day t spreads.
    - Enter at settlement close of day t+1, never day t.
    - No entry when either leg <= 3 calendar days of expiry on signal day.
    - 1 position per exact pair; no same-day re-entry after exit.
    - Cap open positions at MAX_OPEN (default 4).
    - If settlement price missing on entry: skip trade. If missing on exit: use next available day.
    - Exit when |robust_z| <= EXIT_Z, hold_days >= MAX_HOLD_DAYS, or leg <= 2 days to expiry.
    - Forced exit on final day of data.
    - Integer lots minimizing gram mismatch; unhedged residual recorded.
    """
    if not trade_dates:
        raise ValueError("trade_dates sequence cannot be empty")

    sorted_dates = sorted(trade_dates)
    data_from = sorted_dates[0]
    data_to = sorted_dates[-1]

    # Resolve parameter defaults
    entry_z = (
        float(params.get("entry_z", settings.BACKTEST_ENTRY_Z))
        if params
        else settings.BACKTEST_ENTRY_Z
    )
    exit_z = (
        float(params.get("exit_z", settings.BACKTEST_EXIT_Z))
        if params
        else settings.BACKTEST_EXIT_Z
    )
    max_hold_days = (
        int(params.get("max_hold_days", settings.BACKTEST_MAX_HOLD_DAYS))
        if params
        else settings.BACKTEST_MAX_HOLD_DAYS
    )
    max_open = (
        int(params.get("max_open", settings.BACKTEST_MAX_OPEN))
        if params
        else settings.BACKTEST_MAX_OPEN
    )
    train_fraction = (
        float(params.get("train_fraction", settings.BACKTEST_TRAIN_FRACTION))
        if params
        else settings.BACKTEST_TRAIN_FRACTION
    )
    cost_bps_per_side = (
        float(params.get("cost_bps_per_side", settings.BACKTEST_COST_BPS_PER_SIDE))
        if params
        else settings.BACKTEST_COST_BPS_PER_SIDE
    )

    active_params = {
        "entry_z": entry_z,
        "exit_z": exit_z,
        "max_hold_days": max_hold_days,
        "max_open": max_open,
        "train_fraction": train_fraction,
        "cost_bps_per_side": cost_bps_per_side,
    }

    # Split train and held-out
    split_idx = max(1, int(len(sorted_dates) * train_fraction))
    train_dates = sorted_dates[:split_idx]
    train_to = train_dates[-1]

    open_positions: list[SimulatedTrade] = []
    completed_trades: list[SimulatedTrade] = []
    daily_records: list[SimulationDailyState] = []
    skipped_signals: list[dict[str, Any]] = []
    pending_orders: list[PendingEntryOrder] = []
    last_exit_date_by_pair: dict[tuple[str, date, str, date], date] = {}

    for i, curr_date in enumerate(sorted_dates):
        prev_date = sorted_dates[i - 1] if i > 0 else None
        daily_gross_pnl = Decimal("0")
        daily_costs = Decimal("0")

        # -------------------------------------------------------------
        # 1. Execute Pending Entry Orders on Day curr_date (settlement close)
        # -------------------------------------------------------------
        remaining_pending: list[PendingEntryOrder] = []
        for order in pending_orders:
            pair_key = (order.symbol_a, order.expiry_a, order.symbol_b, order.expiry_b)
            # Check price availability on entry day
            price_a = prices_by_contract_and_date.get((order.symbol_a, order.expiry_a, curr_date))
            price_b = prices_by_contract_and_date.get((order.symbol_b, order.expiry_b, curr_date))

            if price_a is None or price_b is None:
                skipped_signals.append(
                    {
                        "signal_date": order.signal_date.isoformat(),
                        "entry_date": curr_date.isoformat(),
                        "pair": f"{order.symbol_a}-{order.symbol_b}",
                        "reason": "missing_settlement_price_on_entry",
                    }
                )
                continue

            # Check capacity and same-pair position constraints
            if len(open_positions) >= max_open:
                skipped_signals.append(
                    {
                        "signal_date": order.signal_date.isoformat(),
                        "entry_date": curr_date.isoformat(),
                        "pair": f"{order.symbol_a}-{order.symbol_b}",
                        "reason": "max_open_positions_reached",
                    }
                )
                continue

            pair_is_open = any(
                (p.symbol_a, p.expiry_a, p.symbol_b, p.expiry_b) == pair_key for p in open_positions
            )
            if pair_is_open:
                skipped_signals.append(
                    {
                        "signal_date": order.signal_date.isoformat(),
                        "entry_date": curr_date.isoformat(),
                        "pair": f"{order.symbol_a}-{order.symbol_b}",
                        "reason": "pair_already_open",
                    }
                )
                continue

            # Size the trade
            spec_a = specs_by_symbol.get(order.symbol_a)
            spec_b = specs_by_symbol.get(order.symbol_b)
            unit_a = spec_a.trading_unit_grams if spec_a else Decimal("100")
            unit_b = spec_b.trading_unit_grams if spec_b else Decimal("10")
            quote_a = spec_a.quote_unit_grams if spec_a else Decimal("10")
            quote_b = spec_b.quote_unit_grams if spec_b else Decimal("10")

            allocation = calculate_lot_allocation(unit_a, unit_b, order.direction)

            # Compute entry costs
            cost_a = calculate_leg_cost(
                price=price_a,
                lots=allocation.lots_a,
                trading_unit_grams=unit_a,
                quote_unit_grams=quote_a,
                weaker_liquidity_label=order.weaker_liquidity_label,
                base_cost_bps=cost_bps_per_side,
            )
            cost_b = calculate_leg_cost(
                price=price_b,
                lots=allocation.lots_b,
                trading_unit_grams=unit_b,
                quote_unit_grams=quote_b,
                weaker_liquidity_label=order.weaker_liquidity_label,
                base_cost_bps=cost_bps_per_side,
            )
            trade_entry_cost = cost_a + cost_b
            daily_costs += trade_entry_cost

            spread_bps = ((price_a - price_b) / price_b) * Decimal("10000")

            trade = SimulatedTrade(
                entry_date=curr_date,
                exit_date=None,
                symbol_a=order.symbol_a,
                expiry_a=order.expiry_a,
                symbol_b=order.symbol_b,
                expiry_b=order.expiry_b,
                direction=order.direction,
                lots_a=allocation.lots_a,
                lots_b=allocation.lots_b,
                entry_price_a=price_a,
                entry_price_b=price_b,
                entry_spread_bps=spread_bps,
                entry_cost=trade_entry_cost,
                residual_gram_mismatch=allocation.residual_gram_mismatch,
                weaker_liquidity_label=order.weaker_liquidity_label,
                days_held=0,
            )
            open_positions.append(trade)

        pending_orders = remaining_pending

        # -------------------------------------------------------------
        # 2. Daily Holding P&L for Positions Held Overnight
        # -------------------------------------------------------------
        if prev_date is not None:
            for pos in open_positions:
                if pos.entry_date == curr_date:
                    # Entered today at settlement close; no price movement since entry
                    continue

                p_a_curr = prices_by_contract_and_date.get((pos.symbol_a, pos.expiry_a, curr_date))
                p_b_curr = prices_by_contract_and_date.get((pos.symbol_b, pos.expiry_b, curr_date))
                p_a_prev = prices_by_contract_and_date.get((pos.symbol_a, pos.expiry_a, prev_date))
                p_b_prev = prices_by_contract_and_date.get((pos.symbol_b, pos.expiry_b, prev_date))

                if (
                    p_a_curr is not None
                    and p_a_prev is not None
                    and p_b_curr is not None
                    and p_b_prev is not None
                ):
                    spec_a = specs_by_symbol.get(pos.symbol_a)
                    spec_b = specs_by_symbol.get(pos.symbol_b)
                    mult_a = (
                        (spec_a.trading_unit_grams / spec_a.quote_unit_grams)
                        if spec_a
                        else Decimal("10")
                    )
                    mult_b = (
                        (spec_b.trading_unit_grams / spec_b.quote_unit_grams)
                        if spec_b
                        else Decimal("1")
                    )

                    delta_a = p_a_curr - p_a_prev
                    delta_b = p_b_curr - p_b_prev

                    dir_a = Decimal("1") if pos.direction == "long_a_short_b" else Decimal("-1")
                    dir_b = Decimal("-1") if pos.direction == "long_a_short_b" else Decimal("1")

                    pos_pnl_a = dir_a * Decimal(pos.lots_a) * delta_a * mult_a
                    pos_pnl_b = dir_b * Decimal(pos.lots_b) * delta_b * mult_b

                    pos_daily_gross = pos_pnl_a + pos_pnl_b
                    pos.gross_pnl += pos_daily_gross
                    daily_gross_pnl += pos_daily_gross

                pos.days_held += 1

        # -------------------------------------------------------------
        # 3. Execute Pending Exits on Day curr_date
        # -------------------------------------------------------------
        still_open: list[SimulatedTrade] = []
        for pos in open_positions:
            if not pos.pending_exit:
                still_open.append(pos)
                continue

            # Need prices on curr_date to execute exit
            p_a_exit = prices_by_contract_and_date.get((pos.symbol_a, pos.expiry_a, curr_date))
            p_b_exit = prices_by_contract_and_date.get((pos.symbol_b, pos.expiry_b, curr_date))

            if p_a_exit is None or p_b_exit is None:
                # Delay exit until next available day
                pos.exit_delay_days += 1
                still_open.append(pos)
                continue

            # Compute exit costs
            spec_a = specs_by_symbol.get(pos.symbol_a)
            spec_b = specs_by_symbol.get(pos.symbol_b)
            unit_a = spec_a.trading_unit_grams if spec_a else Decimal("100")
            unit_b = spec_b.trading_unit_grams if spec_b else Decimal("10")
            quote_a = spec_a.quote_unit_grams if spec_a else Decimal("10")
            quote_b = spec_b.quote_unit_grams if spec_b else Decimal("10")

            cost_a = calculate_leg_cost(
                price=p_a_exit,
                lots=pos.lots_a,
                trading_unit_grams=unit_a,
                quote_unit_grams=quote_a,
                weaker_liquidity_label=pos.weaker_liquidity_label,
                base_cost_bps=cost_bps_per_side,
            )
            cost_b = calculate_leg_cost(
                price=p_b_exit,
                lots=pos.lots_b,
                trading_unit_grams=unit_b,
                quote_unit_grams=quote_b,
                weaker_liquidity_label=pos.weaker_liquidity_label,
                base_cost_bps=cost_bps_per_side,
            )
            trade_exit_cost = cost_a + cost_b
            daily_costs += trade_exit_cost

            pos.exit_date = curr_date
            pos.exit_price_a = p_a_exit
            pos.exit_price_b = p_b_exit
            pos.exit_spread_bps = ((p_a_exit - p_b_exit) / p_b_exit) * Decimal("10000")
            pos.exit_cost = trade_exit_cost
            pos.costs = pos.entry_cost + pos.exit_cost
            pos.net_pnl = pos.gross_pnl - pos.costs
            pos.exit_reason = pos.pending_exit_reason
            if pos.exit_delay_days > 0:
                pos.exit_reason += f" (delayed {pos.exit_delay_days}d)"

            completed_trades.append(pos)
            pair_key = (pos.symbol_a, pos.expiry_a, pos.symbol_b, pos.expiry_b)
            last_exit_date_by_pair[pair_key] = curr_date

        open_positions = still_open

        # -------------------------------------------------------------
        # 4. Check Exit Conditions at Close of curr_date
        # -------------------------------------------------------------
        spreads_today = {
            (s.symbol_a, s.expiry_a, s.symbol_b, s.expiry_b): s
            for s in spreads_by_date.get(curr_date, [])
        }

        is_last_day = i == len(sorted_dates) - 1

        for pos in open_positions:
            if pos.pending_exit:
                continue

            cal_days_to_exp_a = (pos.expiry_a - curr_date).days
            cal_days_to_exp_b = (pos.expiry_b - curr_date).days

            spread_rec = spreads_today.get((pos.symbol_a, pos.expiry_a, pos.symbol_b, pos.expiry_b))
            z_val = (
                abs(float(spread_rec.robust_z))
                if (spread_rec and spread_rec.robust_z is not None)
                else None
            )

            # Exit triggers
            if is_last_day:
                # Force close at end of data
                pos.pending_exit = True
                pos.pending_exit_reason = "end_of_data"
            elif cal_days_to_exp_a <= 2 or cal_days_to_exp_b <= 2:
                pos.pending_exit = True
                pos.pending_exit_reason = "near_expiry"
            elif pos.days_held >= max_hold_days:
                pos.pending_exit = True
                pos.pending_exit_reason = "max_hold_days"
            elif z_val is not None and z_val <= exit_z:
                pos.pending_exit = True
                pos.pending_exit_reason = "robust_z_convergence"

        # If it is the last day and positions are marked for end_of_data, execute them immediately
        if is_last_day and open_positions:
            for pos in open_positions:
                p_a_exit = prices_by_contract_and_date.get(
                    (pos.symbol_a, pos.expiry_a, curr_date), pos.entry_price_a
                )
                p_b_exit = prices_by_contract_and_date.get(
                    (pos.symbol_b, pos.expiry_b, curr_date), pos.entry_price_b
                )

                spec_a = specs_by_symbol.get(pos.symbol_a)
                spec_b = specs_by_symbol.get(pos.symbol_b)
                unit_a = spec_a.trading_unit_grams if spec_a else Decimal("100")
                unit_b = spec_b.trading_unit_grams if spec_b else Decimal("10")
                quote_a = spec_a.quote_unit_grams if spec_a else Decimal("10")
                quote_b = spec_b.quote_unit_grams if spec_b else Decimal("10")

                cost_a = calculate_leg_cost(
                    p_a_exit,
                    pos.lots_a,
                    unit_a,
                    quote_a,
                    pos.weaker_liquidity_label,
                    cost_bps_per_side,
                )
                cost_b = calculate_leg_cost(
                    p_b_exit,
                    pos.lots_b,
                    unit_b,
                    quote_b,
                    pos.weaker_liquidity_label,
                    cost_bps_per_side,
                )
                trade_exit_cost = cost_a + cost_b
                daily_costs += trade_exit_cost

                pos.exit_date = curr_date
                pos.exit_price_a = p_a_exit
                pos.exit_price_b = p_b_exit
                pos.exit_spread_bps = ((p_a_exit - p_b_exit) / p_b_exit) * Decimal("10000")
                pos.exit_cost = trade_exit_cost
                pos.costs = pos.entry_cost + pos.exit_cost
                pos.net_pnl = pos.gross_pnl - pos.costs
                pos.exit_reason = "end_of_data"
                completed_trades.append(pos)
            open_positions = []

        # -------------------------------------------------------------
        # 5. Generate New Entry Signals at Close of curr_date
        # -------------------------------------------------------------
        if not is_last_day:
            for s in spreads_by_date.get(curr_date, []):
                if s.robust_z is None:
                    continue
                abs_z = abs(float(s.robust_z))
                if abs_z < entry_z:
                    continue
                if s.weaker_liquidity_label not in ("High", "Medium"):
                    continue

                pair_key = (s.symbol_a, s.expiry_a, s.symbol_b, s.expiry_b)

                # Clarification 1: No entry when either leg within 3 calendar days of expiry
                if (s.expiry_a - curr_date).days <= 3 or (s.expiry_b - curr_date).days <= 3:
                    skipped_signals.append(
                        {
                            "signal_date": curr_date.isoformat(),
                            "pair": f"{s.symbol_a}-{s.symbol_b}",
                            "reason": "near_expiry_signal_day (<= 3 days)",
                        }
                    )
                    continue

                # Clarification 2: 1 open position per exact pair, no same-day re-entry after exit
                already_open = any(
                    (p.symbol_a, p.expiry_a, p.symbol_b, p.expiry_b) == pair_key
                    for p in open_positions
                )
                if already_open:
                    skipped_signals.append(
                        {
                            "signal_date": curr_date.isoformat(),
                            "pair": f"{s.symbol_a}-{s.symbol_b}",
                            "reason": "pair_already_open",
                        }
                    )
                    continue

                if last_exit_date_by_pair.get(pair_key) == curr_date:
                    skipped_signals.append(
                        {
                            "signal_date": curr_date.isoformat(),
                            "pair": f"{s.symbol_a}-{s.symbol_b}",
                            "reason": "same_day_reentry_blocked",
                        }
                    )
                    continue

                total_projected = len(open_positions) + len(pending_orders)
                if total_projected >= max_open:
                    skipped_signals.append(
                        {
                            "signal_date": curr_date.isoformat(),
                            "pair": f"{s.symbol_a}-{s.symbol_b}",
                            "reason": "max_open_capacity_reached",
                        }
                    )
                    continue

                # Direction: long the cheaper contract, short the richer
                # robust_z > 0 means spread (A - B) is unusually high -> A is rich, B is cheap
                direction = "long_b_short_a" if float(s.robust_z) > 0 else "long_a_short_b"

                pending_orders.append(
                    PendingEntryOrder(
                        signal_date=curr_date,
                        symbol_a=s.symbol_a,
                        expiry_a=s.expiry_a,
                        symbol_b=s.symbol_b,
                        expiry_b=s.expiry_b,
                        direction=direction,
                        weaker_liquidity_label=s.weaker_liquidity_label,
                        signal_spread_bps=s.spread_bps,
                    )
                )

        # -------------------------------------------------------------
        # 6. Benchmark Daily Gold Return & Portfolio State
        # -------------------------------------------------------------
        bench_returns: list[Decimal] = []
        if prev_date is not None:
            # Equal-weight mean daily return across available contracts
            for (sym, exp, d_curr), fine_price in fine_gold_by_contract_and_date.items():
                if d_curr == curr_date:
                    prev_fine = fine_gold_by_contract_and_date.get((sym, exp, prev_date))
                    if prev_fine is not None and prev_fine > Decimal("0"):
                        bench_returns.append((fine_price - prev_fine) / prev_fine)

        daily_gold_return = (
            sum(bench_returns) / Decimal(len(bench_returns)) if bench_returns else None
        )

        daily_strategy_pnl = daily_gross_pnl - daily_costs

        daily_records.append(
            SimulationDailyState(
                trade_date=curr_date,
                strategy_pnl=daily_strategy_pnl,
                gross_pnl=daily_gross_pnl,
                costs=daily_costs,
                gold_return=daily_gold_return,
                open_positions=len(open_positions),
            )
        )

    # -----------------------------------------------------------------
    # 7. Summary Metrics & Walk-Forward Attribution
    # -----------------------------------------------------------------
    train_set_dates = set(train_dates)

    train_trades = [t for t in completed_trades if t.exit_date and t.exit_date in train_set_dates]
    held_out_trades = [
        t for t in completed_trades if t.exit_date and t.exit_date not in train_set_dates
    ]

    train_daily = [d for d in daily_records if d.trade_date in train_set_dates]
    held_out_daily = [d for d in daily_records if d.trade_date not in train_set_dates]

    def build_period_metrics(
        trades: list[SimulatedTrade], dailies: list[SimulationDailyState]
    ) -> dict[str, Any]:
        tot_gross = sum((t.gross_pnl for t in trades), Decimal("0"))
        tot_costs = sum((t.costs for t in trades), Decimal("0"))
        tot_net = sum((t.net_pnl for t in trades), Decimal("0"))
        wins = sum(1 for t in trades if t.net_pnl > Decimal("0"))
        hit_rate = round(float(wins / len(trades)), 4) if trades else 0.0
        max_dd = compute_max_drawdown([d.strategy_pnl for d in dailies])

        # Attribution regression
        # Scaled strategy daily return: daily net P&L / estimated gross notional
        # Using 150,000 as typical 100g notional scale factor for return calculation
        strat_returns = [
            float(d.strategy_pnl) / 150000.0 for d in dailies if d.gold_return is not None
        ]
        gold_rets = [float(d.gold_return) for d in dailies if d.gold_return is not None]

        attrib = compute_attribution(
            strat_returns, gold_rets, min_days=settings.BACKTEST_ATTRIB_MIN_DAYS
        )

        return {
            "trades": len(trades),
            "days": len(dailies),
            "gross_pnl": float(round(tot_gross, 2)),
            "costs": float(round(tot_costs, 2)),
            "net_pnl": float(round(tot_net, 2)),
            "hit_rate": hit_rate,
            "max_drawdown": float(round(max_dd, 2)),
            "attribution": attrib,
        }

    train_metrics = build_period_metrics(train_trades, train_daily)
    held_out_metrics = build_period_metrics(held_out_trades, held_out_daily)

    # Clarification 4: Verdict and all headline numbers come from held-out period only
    verdict = determine_verdict(
        held_out_trade_count=len(held_out_trades),
        held_out_days_count=len(held_out_daily),
        held_out_net_pnl=Decimal(str(held_out_metrics["net_pnl"])),
        min_trades=settings.BACKTEST_MIN_TRADES,
        min_days=settings.BACKTEST_MIN_DAYS,
    )

    summary: dict[str, Any] = {
        "verdict": verdict,
        "disclaimer": "Result is on limited history and is not investment advice.",
        "execution_notice": "Settlement prices are not executable fills.",
        "headline": held_out_metrics,
        "train_summary": train_metrics,
        "held_out_summary": held_out_metrics,
        "total_trades": len(completed_trades),
        "total_days": len(sorted_dates),
        "skipped_signals_count": len(skipped_signals),
    }

    return BacktestSimulationResult(
        data_from=data_from,
        data_to=data_to,
        train_to=train_to,
        params=active_params,
        daily_records=daily_records,
        trades=completed_trades,
        summary=summary,
        skipped_signals=skipped_signals,
    )
