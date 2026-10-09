"""CLI tool to fetch, archive, and parse a single MCX Bhavcopy date."""

import argparse
import os
import sys
from datetime import datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.ingest.archive import archive_raw_fetch
from app.ingest.fetcher import LiveFetchDisabledError, fetch_bhavcopy
from app.ingest.parser import filter_gold_contracts, parse_bhavcopy


def main() -> None:
    """Fetch, archive, and parse a single MCX Bhavcopy by date."""
    if not settings.MCX_LIVE_FETCH_ENABLED:
        print("Error: Automated MCX live fetching is disabled by default.")
        print("Automated data collection requires prior written consent from MCX India.")
        print("To load and analyze Bhavcopy data, manually download/save the file from the")
        print("MCX website and import it using:")
        print("    python scripts/import_file.py <path_to_file> [--date DD/MM/YYYY]")
        sys.exit(1)

    parser = argparse.ArgumentParser(
        description="Fetch, archive, and parse official MCX Bhavcopy for a given date.",
    )
    parser.add_argument(
        "date",
        type=str,
        help="Date to fetch in DD/MM/YYYY format (e.g., 08/10/2026)",
    )
    args = parser.parse_args()

    try:
        requested_date = datetime.strptime(args.date.strip(), "%d/%m/%Y").date()
    except ValueError:
        print(f"Error: Invalid date format '{args.date}'. Expected DD/MM/YYYY.")
        sys.exit(1)

    print(f"--> Fetching Bhavcopy for requested date: {requested_date.strftime('%d/%m/%Y')}...")
    try:
        raw_fetch = fetch_bhavcopy(requested_date)
    except LiveFetchDisabledError as exc:
        print(f"Fetch refused: {exc}")
        sys.exit(1)
    except Exception as exc:
        print(f"Fetch failed: {type(exc).__name__}: {exc}")
        sys.exit(1)

    print(f"    Status: {raw_fetch.status_code}")
    print(f"    Payload size: {len(raw_fetch.content)} bytes")
    print(f"    SHA-256: {raw_fetch.sha256}")

    # Archiving must happen before parsing
    print("--> Archiving raw payload to data/raw/...")
    raw_path, sidecar_path = archive_raw_fetch(raw_fetch)
    print(f"    Raw file: {raw_path}")
    print(f"    Sidecar:  {sidecar_path}")

    # Parse
    print("--> Parsing payload...")
    parse_result = parse_bhavcopy(raw_fetch)

    # Gold contracts
    gold_rows = filter_gold_contracts(parse_result.rows)
    gold_symbols_found = sorted(set(r.symbol for r in gold_rows))

    print("\n========== INGESTION SUMMARY ==========")
    print(f"Requested Date:      {requested_date.strftime('%d/%m/%Y')}")
    trade_date_str = (
        parse_result.trade_date.strftime("%d/%m/%Y")
        if parse_result.trade_date
        else "None (no trading rows returned)"
    )
    print(f"Returned Trade Date: {trade_date_str}")
    if parse_result.trade_date and parse_result.trade_date != requested_date:
        print("    [NOTE] Returned trade date differs from requested date (holiday/fallback).")

    print(f"Total Rows Parsed:   {len(parse_result.rows)}")
    gold_str = ", ".join(gold_symbols_found) if gold_symbols_found else "None"
    print(f"Gold Contracts Found: {gold_str}")
    print(f"Gold Rows Count:     {len(gold_rows)}")
    print(f"Parse Errors:        {len(parse_result.errors)}")

    if parse_result.errors:
        print("\nParse Errors Details:")
        for idx, err in enumerate(parse_result.errors[:5], start=1):
            print(f"  {idx}. Reason: {err.reason} | Raw: {err.raw_row}")
        if len(parse_result.errors) > 5:
            print(f"  ... and {len(parse_result.errors) - 5} more.")

    print("=======================================")


if __name__ == "__main__":
    main()
