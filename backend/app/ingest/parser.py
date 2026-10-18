"""MCX Bhavcopy parser into validated Pydantic v2 models."""

import csv
import io
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
    open: Decimal | None = Field(default=None, description="Opening price")
    high: Decimal | None = Field(default=None, description="Highest traded price")
    low: Decimal | None = Field(default=None, description="Lowest traded price")
    close: Decimal = Field(description="Closing / settlement price")
    volume: int = Field(description="Traded volume in contracts / lots")
    open_interest: int = Field(description="Open interest in contracts")
    instrument: str = Field(default="FUTCOM", description="Instrument name e.g. FUTCOM, OPTFUT")


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
    """Parse exchange Date field (expected format: MM/DD/YYYY or DD Mon YYYY)."""
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip()
    for fmt in ("%m/%d/%Y", "%d %b %Y", "%d-%b-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return datetime.strptime(s, "%m/%d/%Y").date()


def _parse_expiry_date(val: Any) -> date:
    """Parse exchange ExpiryDate field (expected format: 04SEP2026)."""
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, datetime):
        return val.date()
    s = str(val).strip().upper()
    return datetime.strptime(s, "%d%b%Y").date()


def _parse_csv_payload(
    text_content: str,
    req_date: date | None,
) -> BhavcopyParseResult:
    """Parse CSV text format into BhavcopyParseResult."""
    reader = csv.DictReader(io.StringIO(text_content))
    parsed_rows: list[BhavcopyRow] = []
    errors: list[ParseError] = []
    discovered_trade_date: date | None = None

    for raw_row in reader:
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

            raw_expiry = raw_row.get("Expiry Date") or raw_row.get("ExpiryDate")
            if raw_expiry is None:
                raise ValueError("Missing ExpiryDate field")
            expiry_date = _parse_expiry_date(raw_expiry)

            # Instrument Name
            instrument = (
                (raw_row.get("Instrument Name") or raw_row.get("InstrumentName") or "FUTCOM")
                .strip()
                .upper()
            )

            # Prices to Decimal (None if blank; never fill blanks from Close)
            open_str = (raw_row.get("Open") or "").strip()
            high_str = (raw_row.get("High") or "").strip()
            low_str = (raw_row.get("Low") or "").strip()
            close_str = (raw_row.get("Close") or "").strip()

            open_price = Decimal(open_str) if open_str else None
            high_price = Decimal(high_str) if high_str else None
            low_price = Decimal(low_str) if low_str else None
            if not close_str:
                raise ValueError("Missing or blank Close price")
            close_price = Decimal(close_str)

            # Volume & Open Interest to int
            vol_str = (raw_row.get("Volume(Lots)") or raw_row.get("Volume") or "0").strip()
            oi_str = (
                raw_row.get("Open Interest(Lots)") or raw_row.get("OpenInterest") or "0"
            ).strip()
            volume = int(float(vol_str or 0))
            open_interest = int(float(oi_str or 0))

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
                instrument=instrument,
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


def parse_bhavcopy(
    raw: bytes | str | dict[str, Any] | RawFetch,
    requested_date: date | None = None,
) -> BhavcopyParseResult:
    """Parse MCX Bhavcopy response payload into typed BhavcopyRow objects.

    Guarantees:
    - Normalizes symbol (strip whitespace, uppercase).
    - Parses MM/DD/YYYY or DD Mon YYYY for trade date and 04SEP2026 for expiry date.
    - Decimals for prices, integers for volume & open interest.
    - Supports both JSON MCX API responses and CSV Bhavcopy formats.
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

    # Check for text string vs JSON/dict
    if isinstance(raw_bytes_or_str, bytes | bytearray):
        text_content = raw_bytes_or_str.decode("utf-8", errors="replace")
    elif isinstance(raw_bytes_or_str, str):
        text_content = raw_bytes_or_str
    else:
        text_content = None

    if text_content is not None:
        trimmed = text_content.strip()
        # If it looks like JSON object or list, try parsing as JSON
        if trimmed.startswith(("{", "[")):
            try:
                payload = json.loads(trimmed)
            except Exception as exc:
                return BhavcopyParseResult(
                    requested_date=req_date,
                    trade_date=None,
                    rows=[],
                    errors=[ParseError(raw_row=trimmed[:200], reason=f"Invalid JSON: {exc}")],
                )
        else:
            # Check if it has CSV header (e.g. contains 'Date' and 'Symbol')
            if "Date" in text_content and "Symbol" in text_content:
                return _parse_csv_payload(text_content, req_date)
            return BhavcopyParseResult(
                requested_date=req_date,
                trade_date=None,
                rows=[],
                errors=[
                    ParseError(
                        raw_row=trimmed[:200],
                        reason="Unrecognized payload format: neither JSON nor CSV",
                    )
                ],
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

            # Instrument Name
            instrument = str(raw_row.get("InstrumentName", "FUTCOM")).strip().upper()

            # Prices to Decimal (None if blank or None)
            raw_open = raw_row.get("Open")
            open_price = (
                Decimal(str(raw_open).strip())
                if raw_open is not None and str(raw_open).strip() != ""
                else None
            )

            raw_high = raw_row.get("High")
            high_price = (
                Decimal(str(raw_high).strip())
                if raw_high is not None and str(raw_high).strip() != ""
                else None
            )

            raw_low = raw_row.get("Low")
            low_price = (
                Decimal(str(raw_low).strip())
                if raw_low is not None and str(raw_low).strip() != ""
                else None
            )

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
                instrument=instrument,
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
