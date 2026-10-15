#!/usr/bin/env python3
"""Run daily analytics pipeline, track record append, brief delivery, and integrity check."""

import argparse
import os
import sys
from datetime import date
from typing import Any

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.parity import compute_parity
from app.analytics.spreads import compute_spreads
from app.core.database import SessionLocal
from app.liquidity.service import compute_liquidity
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.parity import ParityScoreRecord
from app.models.spread import SpreadRecord
from app.models.track_record import BriefSentRecord
from app.normalize.service import compute_normalized
from app.publish.brief import build_brief
from app.publish.chain import append_record, verify_chain
from app.publish.notify import deliver_brief


def run_daily_pipeline(session: Session, target_date: date) -> dict[str, Any]:
    """Execute stages S5 through S10 for target_date idempotently."""
    # 1. Pipeline computations
    compute_normalized(session)
    compute_liquidity(session)
    spread_count = compute_spreads(session, target_date)
    parity_rec = compute_parity(session, target_date)
    session.commit()

    # 2. Append track record entry (idempotent: no-op if identical)
    track_entry = append_record(session, target_date)
    session.commit()

    # 3. Build daily brief
    spread_rows = session.scalars(
        select(SpreadRecord).where(SpreadRecord.trade_date == target_date)
    ).all()
    spreads_summary = [
        {
            "symbol_a": s.symbol_a,
            "symbol_b": s.symbol_b,
            "robust_z": s.robust_z,
            "weaker_liquidity_label": s.weaker_liquidity_label,
        }
        for s in spread_rows
    ]

    parity_dict: dict[str, Any] | None = None
    if parity_rec:
        excluded = (
            parity_rec.details.get("pairs_excluded", 0)
            if isinstance(parity_rec.details, dict)
            else 0
        )
        parity_dict = {
            "score": parity_rec.score,
            "status": parity_rec.status,
            "pairs_used": parity_rec.pairs_used,
            "pairs_excluded": excluded,
        }

    # Fetch previous day parity
    prev_parity_row = session.scalars(
        select(ParityScoreRecord)
        .where(ParityScoreRecord.trade_date < target_date)
        .order_by(ParityScoreRecord.trade_date.desc())
    ).first()
    prev_parity_dict: dict[str, Any] | None = None
    if prev_parity_row:
        prev_parity_dict = {
            "score": prev_parity_row.score,
            "status": prev_parity_row.status,
        }

    brief_text = build_brief(
        trade_date=target_date,
        parity=parity_dict,
        spreads_summary=spreads_summary,
        prev_parity=prev_parity_dict,
    )

    # 4. Deliver brief if not already delivered for target_date
    already_sent = session.scalars(
        select(BriefSentRecord).where(BriefSentRecord.trade_date == target_date)
    ).first()
    if not already_sent:
        brief_status = deliver_brief(session, target_date, brief_text)
    else:
        brief_status = already_sent
    session.commit()

    # 5. Verify cryptographic chain
    chain_status = verify_chain(session)

    return {
        "trade_date": target_date.isoformat(),
        "spread_count": spread_count,
        "parity_score": parity_dict.get("score") if parity_dict else None,
        "parity_status": parity_dict.get("status") if parity_dict else "None",
        "track_record_revision": track_entry.revision if track_entry else "unchanged",
        "brief_channel": brief_status.channel,
        "brief_status": brief_status.status,
        "chain_ok": chain_status["ok"],
        "total_chain_entries": chain_status["entries"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run daily Assay intelligence pipeline")
    parser.add_argument("--date", type=str, help="Target trade date (YYYY-MM-DD)")
    args = parser.parse_args()

    session = SessionLocal()
    try:
        if args.date:
            target_date = date.fromisoformat(args.date)
        else:
            latest = session.scalars(
                select(BhavcopyRowRecord.trade_date).order_by(BhavcopyRowRecord.trade_date.desc())
            ).first()
            target_date = latest if latest else date.today()

        summary = run_daily_pipeline(session, target_date)

        print("\n================ Assay Daily Execution Summary ================")
        print(f"Trade Date:             {summary['trade_date']}")
        print(f"Spreads Computed:       {summary['spread_count']}")
        print(f"Parity Score:           {summary['parity_score']} ({summary['parity_status']})")
        print(f"Track Record Revision:  {summary['track_record_revision']}")
        print(f"Brief Delivery:         {summary['brief_channel']} ({summary['brief_status']})")
        chain_str = "VALID" if summary["chain_ok"] else "INVALID"
        print(f"Cryptographic Chain:    {chain_str} ({summary['total_chain_entries']} entries)")
        print("===============================================================\n")
    finally:
        session.close()


if __name__ == "__main__":
    main()
