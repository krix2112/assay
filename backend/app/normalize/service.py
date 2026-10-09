"""Stage S5: Gold price normalization module."""

from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.models.bhavcopy import BhavcopyRowRecord
from app.models.contract_spec import ContractSpec
from app.models.normalized_price import NormalizedPriceRecord


@dataclass(frozen=True)
class NormalizedPrice:
    """Immutable normalized price metrics for a single market row."""

    symbol: str
    expiry_date: date
    trade_date: date
    close_price: Decimal
    price_per_gram: Decimal
    fine_gold_price_per_gram: Decimal
    method_version: str = "v1"


def normalize_row(
    row: BhavcopyRowRecord,
    spec: ContractSpec,
    method_version: str = "v1",
) -> NormalizedPrice:
    """Compute per-gram and fine gold equivalent prices from bhavcopy settlement close.

    Quotation basis and purity treatment come from the challenge brief and are
    NOT yet verified against the MCX contract specification. Both the plain and
    the purity-adjusted value are stored so the effect of the adjustment stays visible.
    """
    if spec.quote_unit_grams <= Decimal("0"):
        raise ValueError(
            f"Invalid quote_unit_grams for contract {spec.symbol}: {spec.quote_unit_grams}"
        )
    if spec.purity <= Decimal("0"):
        raise ValueError(f"Invalid purity fraction for contract {spec.symbol}: {spec.purity}")

    # Settlement close price used exclusively
    close_dec = Decimal(str(row.close))
    quote_unit_dec = Decimal(str(spec.quote_unit_grams))
    purity_dec = Decimal(str(spec.purity))

    # Full Decimal precision preserved without artificial rounding
    price_per_gram = close_dec / quote_unit_dec
    fine_gold_price_per_gram = price_per_gram / purity_dec

    return NormalizedPrice(
        symbol=row.symbol,
        expiry_date=row.expiry_date,
        trade_date=row.trade_date,
        close_price=close_dec,
        price_per_gram=price_per_gram,
        fine_gold_price_per_gram=fine_gold_price_per_gram,
        method_version=method_version,
    )


def compute_normalized(
    session: Session,
    date_from: date | None = None,
    date_to: date | None = None,
    method_version: str = "v1",
) -> int:
    """Compute and persist normalized prices idempotently for the requested date window.

    Guarantees:
    - Idempotent: Recomputing replaces existing rows with the same method_version.
    - Never mutates bhavcopy_rows.
    """
    # 1. Load contract specs into memory lookup
    specs_list = session.scalars(select(ContractSpec)).all()
    specs_map = {s.symbol: s for s in specs_list}

    # 2. Select matching bhavcopy rows
    query = select(BhavcopyRowRecord)
    if date_from:
        query = query.where(BhavcopyRowRecord.trade_date >= date_from)
    if date_to:
        query = query.where(BhavcopyRowRecord.trade_date <= date_to)

    rows = session.scalars(query).all()
    if not rows:
        return 0

    now_utc = datetime.now(UTC)
    written_count = 0

    for row in rows:
        spec = specs_map.get(row.symbol)
        if not spec:
            logger.warning("Skipping normalization: contract spec missing", symbol=row.symbol)
            continue

        norm = normalize_row(row=row, spec=spec, method_version=method_version)

        # Check existing row in prices_normalized by PK (symbol, expiry_date, trade_date)
        existing = session.get(
            NormalizedPriceRecord,
            (norm.symbol, norm.expiry_date, norm.trade_date),
        )

        if existing is None:
            new_rec = NormalizedPriceRecord(
                symbol=norm.symbol,
                expiry_date=norm.expiry_date,
                trade_date=norm.trade_date,
                close_price=norm.close_price,
                price_per_gram=norm.price_per_gram,
                fine_gold_price_per_gram=norm.fine_gold_price_per_gram,
                method_version=norm.method_version,
                computed_at=now_utc,
            )
            session.add(new_rec)
        else:
            existing.close_price = norm.close_price
            existing.price_per_gram = norm.price_per_gram
            existing.fine_gold_price_per_gram = norm.fine_gold_price_per_gram
            existing.method_version = norm.method_version
            existing.computed_at = now_utc

        written_count += 1

    session.flush()
    logger.info("Normalized prices computed", count=written_count, method_version=method_version)
    return written_count
