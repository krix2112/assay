"""CLI tool to manually import, archive, and parse an MCX Bhavcopy JSON file."""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ingest.importer import import_bhavcopy_file
from app.ingest.parser import filter_gold_contracts


def main() -> None:
    """Import a local MCX Bhavcopy file, archive it, and print parsed summary."""
    parser = argparse.ArgumentParser(
        description="Import, archive, and parse a locally downloaded MCX Bhavcopy file.",
    )
    parser.add_argument(
        "file_path",
        type=str,
        help="Path to the JSON Bhavcopy file to import",
    )
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Optional requested date in DD/MM/YYYY format (e.g. 08/10/2026)",
    )
    args = parser.parse_args()

    requested_date = None
    if args.date:
        try:
            requested_date = datetime.strptime(args.date.strip(), "%d/%m/%Y").date()
        except ValueError:
            print(f"Error: Invalid date format '{args.date}'. Expected DD/MM/YYYY.")
            sys.exit(1)

    file_to_import = Path(args.file_path).resolve()
    if not file_to_import.is_file():
        print(f"Error: File not found at '{file_to_import}'")
        sys.exit(1)

    print(f"--> Importing local Bhavcopy: {file_to_import.name}...")
    try:
        import_result = import_bhavcopy_file(file_to_import, requested_date=requested_date)
    except Exception as exc:
        print(f"Import failed: {type(exc).__name__}: {exc}")
        sys.exit(1)

    raw_fetch = import_result.raw_fetch
    parse_result = import_result.parse_result

    print(f"    Payload size: {len(raw_fetch.content)} bytes")
    print(f"    SHA-256:      {raw_fetch.sha256}")
    print(f"    Archived raw: {import_result.raw_path}")
    print(f"    Sidecar:      {import_result.sidecar_path}")

    # Gold contracts
    gold_rows = filter_gold_contracts(parse_result.rows)
    gold_symbols_found = sorted(set(r.symbol for r in gold_rows))

    print("\n========== IMPORT SUMMARY ==========")
    req_date_str = (
        requested_date.strftime("%d/%m/%Y")
        if requested_date
        else "(None provided; inferred from payload)"
    )
    print(f"Requested Date:       {req_date_str}")
    trade_date_str = (
        parse_result.trade_date.strftime("%d/%m/%Y")
        if parse_result.trade_date
        else "None (no trading rows returned)"
    )
    print(f"Returned Trade Date:  {trade_date_str}")
    if requested_date and parse_result.trade_date and parse_result.trade_date != requested_date:
        print("    [NOTE] Returned trade date differs from requested date (holiday/fallback).")

    print(f"Total Rows Parsed:    {len(parse_result.rows)}")
    gold_str = ", ".join(gold_symbols_found) if gold_symbols_found else "None"
    print(f"Gold Contracts Found: {gold_str}")
    print(f"Gold Rows Count:      {len(gold_rows)}")
    print(f"Parse Errors:         {len(parse_result.errors)}")

    if parse_result.errors:
        print("\nParse Errors Details:")
        for idx, err in enumerate(parse_result.errors[:5], start=1):
            print(f"  {idx}. Reason: {err.reason} | Raw: {err.raw_row}")
        if len(parse_result.errors) > 5:
            print(f"  ... and {len(parse_result.errors) - 5} more.")

    print("====================================")


if __name__ == "__main__":
    main()
