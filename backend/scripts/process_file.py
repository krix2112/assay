"""CLI tool to process a local Bhavcopy file through the Assay pipeline (S1-S4)."""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.pipeline.processor import process_file


def parse_date(date_str: str) -> datetime.date:
    """Parse date from DD/MM/YYYY format."""
    try:
        return datetime.strptime(date_str.strip(), "%d/%m/%Y").date()
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"Invalid date '{date_str}'. Expected DD/MM/YYYY (e.g. 08/10/2026)."
        ) from exc


def main() -> None:
    """Execute pipeline file processing from command line."""
    parser = argparse.ArgumentParser(
        description="Process a local MCX Bhavcopy JSON file through Assay validation and storage."
    )
    parser.add_argument("path", help="Path to local MCX Bhavcopy JSON file")
    parser.add_argument(
        "--date",
        dest="requested_date",
        type=parse_date,
        default=None,
        help="Optional calendar date requested (DD/MM/YYYY format)",
    )
    parser.add_argument(
        "--allow-synthetic",
        dest="allow_synthetic",
        action="store_true",
        default=False,
        help="Explicitly permit importing synthetic test fixtures (prohibited in production)",
    )

    args = parser.parse_args()
    file_path = Path(args.path)

    if not file_path.exists():
        print(f"Error: File not found at {file_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Processing Bhavcopy file: {file_path}")
    if args.requested_date:
        print(f"Requested Date: {args.requested_date.strftime('%d/%m/%Y')}")

    try:
        summary = process_file(
            file_path,
            requested_date=args.requested_date,
            allow_synthetic=args.allow_synthetic,
        )
    except Exception as exc:
        print(f"Pipeline processing failed: {exc}", file=sys.stderr)
        sys.exit(1)

    print("\n--- Pipeline Processing Summary ---")
    print(f"File Path:            {summary.file_path}")
    print(f"SHA-256:              {summary.sha256[:16]}...{summary.sha256[-8:]}")
    print(f"Status:               {summary.status}")
    print(f"Idempotent Skip:      {'Yes' if summary.is_idempotent_skip else 'No'}")
    print(f"Rows Parsed:          {summary.rows_parsed}")
    print(f"Rows Accepted:        {summary.rows_accepted}")
    print(f"Rows Quarantined:     {summary.rows_quarantined}")
    print(f"Warnings Logged:      {summary.warnings_count}")
    print(f"Out of Scope Rows:    {summary.out_of_scope_count}")
    if summary.requested_date:
        print(f"Requested Date:       {summary.requested_date.strftime('%Y-%m-%d')}")
    if summary.returned_trade_date:
        print(f"Returned Trade Date:  {summary.returned_trade_date.strftime('%Y-%m-%d')}")
    print("----------------------------------\n")


if __name__ == "__main__":
    main()
