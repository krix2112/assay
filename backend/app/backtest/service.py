"""Stage S9: Backtest execution and persistence service."""

import hashlib
import json
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.backtest.engine import run_simulation
from app.models.backtest import (
    BacktestDailyRecord,
    BacktestRunRecord,
    BacktestTradeRecord,
)
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.contract_spec import ContractSpec
from app.models.normalized_price import NormalizedPriceRecord
from app.models.spread import SpreadRecord


def compute_run_id(params: dict[str, Any], data_from: date, data_to: date) -> str:
    """Generate deterministic run ID based on parameters and data range."""
    key = f"{json.dumps(params, sort_keys=True)}_{data_from.isoformat()}_{data_to.isoformat()}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:36]


def execute_backtest(
    session: Session,
    data_from: date | None = None,
    data_to: date | None = None,
    params: dict[str, Any] | None = None,
    commit: bool = True,
) -> BacktestRunRecord:
    """Execute walk-forward backtest simulation from database records and persist results.

    Idempotent: replaces any existing run with the same params and date range.
    """
    if params is None:
        params = {}

    # 1. Fetch available trade dates
    dates_stmt = select(SpreadRecord.trade_date).distinct()
    if data_from is not None:
        dates_stmt = dates_stmt.where(SpreadRecord.trade_date >= data_from)
    if data_to is not None:
        dates_stmt = dates_stmt.where(SpreadRecord.trade_date <= data_to)
    dates_stmt = dates_stmt.order_by(SpreadRecord.trade_date.asc())

    available_dates = list(session.execute(dates_stmt).scalars().all())
    if not available_dates:
        raise ValueError("No spread records found for the requested date range")

    eff_from = available_dates[0]
    eff_to = available_dates[-1]

    # 2. Fetch contract specs
    specs_list = session.execute(select(ContractSpec)).scalars().all()
    specs_by_symbol = {s.symbol: s for s in specs_list}

    # 3. Fetch spreads
    spreads_stmt = select(SpreadRecord).where(
        SpreadRecord.trade_date >= eff_from,
        SpreadRecord.trade_date <= eff_to,
    )
    all_spreads = session.execute(spreads_stmt).scalars().all()
    spreads_by_date: dict[date, list[SpreadRecord]] = {}
    for s in all_spreads:
        spreads_by_date.setdefault(s.trade_date, []).append(s)

    # 4. Fetch settlement prices (close) from bhavcopy_rows
    bhav_stmt = select(
        BhavcopyRowRecord.symbol,
        BhavcopyRowRecord.expiry_date,
        BhavcopyRowRecord.trade_date,
        BhavcopyRowRecord.close,
    ).where(
        BhavcopyRowRecord.trade_date >= eff_from,
        BhavcopyRowRecord.trade_date <= eff_to,
    )
    bhav_rows = session.execute(bhav_stmt).all()
    prices_map: dict[tuple[str, date, date], Decimal] = {
        (r.symbol, r.expiry_date, r.trade_date): r.close for r in bhav_rows
    }

    # 5. Fetch fine gold prices from prices_normalized
    norm_stmt = select(
        NormalizedPriceRecord.symbol,
        NormalizedPriceRecord.expiry_date,
        NormalizedPriceRecord.trade_date,
        NormalizedPriceRecord.fine_gold_price_per_gram,
    ).where(
        NormalizedPriceRecord.trade_date >= eff_from,
        NormalizedPriceRecord.trade_date <= eff_to,
    )
    norm_rows = session.execute(norm_stmt).all()
    fine_gold_map: dict[tuple[str, date, date], Decimal] = {
        (r.symbol, r.expiry_date, r.trade_date): r.fine_gold_price_per_gram for r in norm_rows
    }

    # 6. Run pure simulation
    sim_result = run_simulation(
        trade_dates=available_dates,
        spreads_by_date=spreads_by_date,
        prices_by_contract_and_date=prices_map,
        fine_gold_by_contract_and_date=fine_gold_map,
        specs_by_symbol=specs_by_symbol,
        params=params,
    )

    run_id = compute_run_id(sim_result.params, eff_from, eff_to)

    # 7. Idempotently replace existing run
    session.execute(delete(BacktestRunRecord).where(BacktestRunRecord.id == run_id))

    run_record = BacktestRunRecord(
        id=run_id,
        created_at=datetime.now(UTC),
        code_version="v1",
        params=sim_result.params,
        data_from=eff_from,
        data_to=eff_to,
        train_to=sim_result.train_to,
        status="completed",
        summary=sim_result.summary,
    )
    session.add(run_record)
    session.flush()

    daily_records = [
        BacktestDailyRecord(
            run_id=run_id,
            trade_date=d.trade_date,
            strategy_pnl=d.strategy_pnl,
            gross_pnl=d.gross_pnl,
            costs=d.costs,
            gold_return=d.gold_return,
            open_positions=d.open_positions,
        )
        for d in sim_result.daily_records
    ]
    session.add_all(daily_records)

    trade_records = [
        BacktestTradeRecord(
            run_id=run_id,
            entry_date=t.entry_date,
            exit_date=t.exit_date or eff_to,
            symbol_a=t.symbol_a,
            expiry_a=t.expiry_a,
            symbol_b=t.symbol_b,
            expiry_b=t.expiry_b,
            direction=t.direction,
            lots_a=t.lots_a,
            lots_b=t.lots_b,
            entry_spread_bps=t.entry_spread_bps,
            exit_spread_bps=t.exit_spread_bps or Decimal("0"),
            gross_pnl=t.gross_pnl,
            costs=t.costs,
            net_pnl=t.net_pnl,
            exit_reason=t.exit_reason,
            residual_gram_mismatch=t.residual_gram_mismatch,
        )
        for t in sim_result.trades
    ]
    session.add_all(trade_records)

    if commit:
        session.commit()

    return run_record
