"""MCX Bhavcopy parser into validated Pydantic v2 models."""

import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.ingest.fetcher import RawFetch

TARGET_GOLD_SYMBOLS: frozenset[str] = frozenset({"GOLDM", "GOLDTEN", "GOLDGUINEA", "GOLDPETAL"})


class BhavcopyRow(BaseModel):
    """Normalized, typed market row from MCX Bhavcopy."""

    model_config = ConfigDict(frozen=True)

    symbol: str = Field(description="Normalized contract symbol (uppercase, trimmed)")
    trade_date: date = Field(description="Actual market trade date from the exchange")
    expiry_date: date = Field(description="Contract expiry date")
    open: Decimal = Field(description="Opening price")
    high: Decimal = Field(description="Highest traded price")
    low: Decimal = Field(description="Lowest traded price")
    close: Decimal = Field(description="Closing / settlement price")
    volume: int = Field(description="Traded volume in contracts / lots")
    open_interest: int = Field(description="Open interest in contracts")


class ParseError(BaseModel):
    """Detailed error object for any row that failed parsing."""

    model_config = ConfigDict(frozen=True)

    raw_row: Any = Field(description="Original unparsed row data")
    reason: str = Field(description="Reason for parse failure")


class BhavcopyParseResult(BaseModel):
    """Full parsing outcome preserving dates, valid rows, and failures."""

    model_config = ConfigDict(frozen=True)

    requested_date: date | None = Field(
        default=None,
        description="The calendar date requested by the user/system",
    )
    trade_date: date | None = Field(
        default=None,
        description="The trade date returned in the exchange payload",
    )
    rows: list[BhavcopyRow] = Field(default_factory=list)
    errors: list[ParseError] = Field(default_factory=list)

    def __len__(self) -> int:
        """Return count of successfully parsed rows."""
        return len(self.rows)


def _parse_trade_date(val: Any) -> date:
    """Parse exchange Date field (expected format: MM/DD/YYYY)."""
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip()
    return datetime.strptime(s, "%m/%d/%Y").date()


def _parse_expiry_date(val: Any) -> date:
    """Parse exchange ExpiryDate field (expected format: 04SEP2026)."""
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip().upper()
    return datetime.strptime(s, "%d%b%Y").date()


def parse_bhavcopy(
    raw: bytes | str | dict[str, Any] | RawFetch,
    requested_date: date | None = None,
) -> BhavcopyParseResult:
    """Parse MCX Bhavcopy response payload into typed BhavcopyRow objects.

    Guarantees:
    - Normalizes symbol (strip whitespace, uppercase).
    - Parses MM/DD/YYYY for trade date and 04SEP2026 for expiry date.
    - Decimals for prices, integers for volume & open interest.
    - Captures any invalid row in ParseError without silently dropping or modifying.
    - Records both requested_date and the exchange-returned trade_date together.
    """
    req_date = requested_date
    raw_bytes_or_str: bytes | str | dict[str, Any]

    if isinstance(raw, RawFetch):
        if req_date is None:
            req_date = raw.requested_date
        raw_bytes_or_str = raw.content
    else:
        raw_bytes_or_str = raw

    # Decode JSON payload if provided as bytes or string
    payload: Any
    if isinstance(raw_bytes_or_str, bytes | bytearray):
        try:
            payload = json.loads(raw_bytes_or_str.decode("utf-8"))
        except Exception as exc:
            decoded = raw_bytes_or_str.decode("utf-8", errors="replace")
            return BhavcopyParseResult(
                requested_date=req_date,
                trade_date=None,
                rows=[],
                errors=[ParseError(raw_row=decoded, reason=f"Invalid JSON: {exc}")],
            )
    elif isinstance(raw_bytes_or_str, str):
        try:
            payload = json.loads(raw_bytes_or_str)
        except Exception as exc:
            return BhavcopyParseResult(
                requested_date=req_date,
                trade_date=None,
                rows=[],
                errors=[ParseError(raw_row=raw_bytes_or_str, reason=f"Invalid JSON: {exc}")],
            )
    else:
        payload = raw_bytes_or_str

    # Extract row list
    raw_rows: list[Any]
    if isinstance(payload, dict):
        # MCX API response wraps items in 'Data' key
        data_field = payload.get("Data")
        if data_field is None:
            # Weekend/holiday response {"IsSuccess": false, "Message": "No data found."}
            return BhavcopyParseResult(
                requested_date=req_date,
                trade_date=None,
                rows=[],
                errors=[],
            )
        if isinstance(data_field, list):
            raw_rows = data_field
        else:
            return BhavcopyParseResult(
                requested_date=req_date,
                trade_date=None,
                rows=[],
                errors=[ParseError(raw_row=payload, reason="'Data' field is not a list")],
            )
    elif isinstance(payload, list):
        raw_rows = payload
    else:
        msg = "Unexpected payload structure; expected dict or list"
        return BhavcopyParseResult(
            requested_date=req_date,
            trade_date=None,
            rows=[],
            errors=[ParseError(raw_row=payload, reason=msg)],
        )

    parsed_rows: list[BhavcopyRow] = []
    errors: list[ParseError] = []
    discovered_trade_date: date | None = None

    for raw_row in raw_rows:
        if not isinstance(raw_row, dict):
            errors.append(ParseError(raw_row=raw_row, reason="Row is not a dictionary"))
            continue

        try:
            raw_symbol = raw_row.get("Symbol")
            if not raw_symbol or not isinstance(raw_symbol, str):
                raise ValueError("Missing or invalid Symbol")
            symbol = raw_symbol.strip().upper()

            raw_date = raw_row.get("Date")
            if raw_date is None:
                raise ValueError("Missing Date field")
            trade_date = _parse_trade_date(raw_date)
            if discovered_trade_date is None:
                discovered_trade_date = trade_date

            raw_expiry = raw_row.get("ExpiryDate")
            if raw_expiry is None:
                raise ValueError("Missing ExpiryDate field")
            expiry_date = _parse_expiry_date(raw_expiry)

            # Prices to Decimal
            open_price = Decimal(str(raw_row["Open"]).strip())
            high_price = Decimal(str(raw_row["High"]).strip())
            low_price = Decimal(str(raw_row["Low"]).strip())
            close_price = Decimal(str(raw_row["Close"]).strip())

            # Volume & Open Interest to int
            volume = int(float(str(raw_row.get("Volume", 0)).strip()))
            open_interest = int(float(str(raw_row.get("OpenInterest", 0)).strip()))

            row_obj = BhavcopyRow(
                symbol=symbol,
                trade_date=trade_date,
                expiry_date=expiry_date,
                open=open_price,
                high=high_price,
                low=low_price,
                close=close_price,
                volume=volume,
                open_interest=open_interest,
            )
            parsed_rows.append(row_obj)

        except (KeyError, ValueError, InvalidOperation, TypeError) as exc:
            errors.append(ParseError(raw_row=raw_row, reason=str(exc)))

    return BhavcopyParseResult(
        requested_date=req_date,
        trade_date=discovered_trade_date,
        rows=parsed_rows,
        errors=errors,
    )


def filter_gold_contracts(rows: list[BhavcopyRow]) -> list[BhavcopyRow]:
    """Filter parsed Bhavcopy rows to keep only Assay gold futures contracts."""
    return [r for r in rows if r.symbol in TARGET_GOLD_SYMBOLS]
