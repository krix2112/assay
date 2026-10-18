"""CLI script to import a folder of MCX Bhavcopy files (CSV or JSON)."""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.pipeline.processor import process_file


def parse_date_from_filename(filename: str) -> Any:
    """Extract requested date from filename e.g. BhavCopyDateWise_01092026.csv -> 2026-09-01."""
    from datetime import date

    m = re.search(r"(\d{2})(\d{2})(\d{4})", filename)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    return None


def main() -> None:
    """Import all Bhavcopy files from specified folder through the pipeline."""
    parser = argparse.ArgumentParser(
        description="Import all Bhavcopy files from a folder through the Assay pipeline."
    )
    parser.add_argument(
        "folder",
        type=str,
        help="Path to folder containing Bhavcopy files (e.g. data/incoming)",
    )
    args = parser.parse_args()

    folder_path = Path(args.folder).resolve()
    if not folder_path.is_dir():
        alt_path = (Path(__file__).resolve().parent.parent.parent / args.folder).resolve()
        if alt_path.is_dir():
            folder_path = alt_path
        else:
            print(f"Error: Directory not found: {folder_path}", file=sys.stderr)
            sys.exit(1)

    files = sorted(
        [p for p in folder_path.iterdir() if p.is_file() and p.suffix.lower() in {".csv", ".json"}]
    )

    if not files:
        print(f"No CSV or JSON files found in {folder_path}")
        sys.exit(0)

    print(f"Found {len(files)} files to process in {folder_path.name}/\n")

    files_imported = 0
    files_skipped = 0
    total_rows_accepted = 0
    total_identical_rows = 0
    total_quarantined_rows = 0
    all_conflicts: list[dict[str, Any]] = []
    date_mismatches: list[dict[str, Any]] = []
    quarantined_files: list[dict[str, Any]] = []

    for idx, f in enumerate(files, start=1):
        req_date = parse_date_from_filename(f.name)
        try:
            summary = process_file(f, requested_date=req_date)
            if summary.is_idempotent_skip:
                files_skipped += 1
                sha_prefix = summary.sha256[:8]
                print(f"[{idx}/{len(files)}] {f.name}: SKIPPED (imported: {sha_prefix}...)")
            else:
                files_imported += 1
                total_rows_accepted += summary.rows_new
                total_identical_rows += summary.rows_identical
                total_quarantined_rows += summary.rows_quarantined

                if summary.conflicts:
                    all_conflicts.extend(summary.conflicts)

                if summary.status == "date_mismatch" or (
                    summary.requested_date and summary.returned_trade_date != summary.requested_date
                ):
                    date_mismatches.append(
                        {
                            "filename": f.name,
                            "filename_date": summary.requested_date,
                            "content_date": summary.returned_trade_date,
                        }
                    )

                if summary.rows_quarantined > 0:
                    quarantined_files.append(
                        {
                            "filename": f.name,
                            "quarantined_count": summary.rows_quarantined,
                        }
                    )

                status_str = summary.status
                print(
                    f"[{idx}/{len(files)}] {f.name}: {status_str} | "
                    f"new_accepted={summary.rows_new}, identical={summary.rows_identical}, "
                    f"conflicts={len(summary.conflicts)}, quarantined={summary.rows_quarantined}"
                )
        except Exception as exc:
            print(f"[{idx}/{len(files)}] {f.name}: ERROR - {exc}", file=sys.stderr)

    print("\n========== IMPORT FOLDER SUMMARY ==========")
    print(f"Files imported:         {files_imported}")
    print(f"Files skipped (identical): {files_skipped}")
    print(f"Rows accepted (new):    {total_rows_accepted}")
    print(f"Identical (no-op) rows: {total_identical_rows}")
    print(f"Total quarantined rows: {total_quarantined_rows}")
    print(f"Date mismatches:        {len(date_mismatches)}")
    print(f"Conflicting revisions:  {len(all_conflicts)}")

    if date_mismatches:
        print("\n--- DATE MISMATCHES ---")
        for dm in date_mismatches:
            print(
                f"File: {dm['filename']} (name date: {dm['filename_date']} "
                f"vs content date: {dm['content_date']})"
            )

    if all_conflicts:
        print("\n--- CONFLICTING REVISIONS ---")
        for c in all_conflicts:
            print(
                f"Symbol: {c['symbol']}, Expiry: {c['expiry_date']}, Date: {c['trade_date']}\n"
                f"  Existing: {c['existing']}\n"
                f"  Incoming: {c['incoming']}"
            )

    if quarantined_files:
        print("\n--- FILES WITH QUARANTINED ROWS ---")
        for qf in quarantined_files:
            print(f"File: {qf['filename']} (quarantined rows: {qf['quarantined_count']})")

    print("===========================================\n")


if __name__ == "__main__":
    main()
