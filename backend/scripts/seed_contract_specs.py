"""Seed contract specifications table idempotently."""

import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from decimal import Decimal

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.logging import logger
from app.models.contract_spec import ContractSpec

CONTRACT_SPECS_DATA = [
    {
        "symbol": "GOLDM",
        "trading_unit_grams": Decimal("100"),
        "quote_unit_grams": Decimal("10"),
        "purity": Decimal("0.995"),
        "expiry_window_start_day": 3,
        "expiry_window_end_day": 5,
        "source_note": "from challenge brief, verify against MCX specification",
    },
    {
        "symbol": "GOLDTEN",
        "trading_unit_grams": Decimal("10"),
        "quote_unit_grams": Decimal("10"),
        "purity": Decimal("0.999"),
        "expiry_window_start_day": 27,
        "expiry_window_end_day": 31,
        "source_note": "from challenge brief, verify against MCX specification",
    },
    {
        "symbol": "GOLDGUINEA",
        "trading_unit_grams": Decimal("8"),
        "quote_unit_grams": Decimal("8"),
        "purity": Decimal("0.999"),
        "expiry_window_start_day": 27,
        "expiry_window_end_day": 31,
        "source_note": "from challenge brief, verify against MCX specification",
    },
    {
        "symbol": "GOLDPETAL",
        "trading_unit_grams": Decimal("1"),
        "quote_unit_grams": Decimal("1"),
        "purity": Decimal("0.999"),
        "expiry_window_start_day": 27,
        "expiry_window_end_day": 31,
        "source_note": "from challenge brief, verify against MCX specification",
    },
]


def seed_contract_specs() -> int:
    """Idempotently seed the contract_specs table."""
    inserted_count = 0
    with SessionLocal() as session:
        with session.begin():
            for item in CONTRACT_SPECS_DATA:
                existing = session.scalar(
                    select(ContractSpec).where(ContractSpec.symbol == item["symbol"])
                )
                if existing is None:
                    session.add(ContractSpec(**item))
                    inserted_count += 1
                else:
                    # Update fields to ensure accurate specs
                    for k, v in item.items():
                        setattr(existing, k, v)

    logger.info("Contract specifications seed completed", inserted=inserted_count)
    return inserted_count


if __name__ == "__main__":
    count = seed_contract_specs()
    print(f"Contract specs verified/seeded ({count} new inserted).")
