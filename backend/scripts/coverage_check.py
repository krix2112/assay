"""CLI script to check MCX Bhavcopy file coverage against target trading days.

Makes no network requests. Reads only filenames matching BhavCopyDateWise_DDMMYYYY.csv.
Lists weekdays without a file in --from/--to grouped by month.
Flags duplicates and badly named files.
Prints how many more trading days are needed to reach 150 (counting dates in bhavcopy_rows).
Does not guess holidays.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text

from app.core.database import engine

FILENAME_PATTERN = re.compile(r"^BhavCopyDateWise_(\d{2})(\d{2})(\d{4})\.csv$")


def parse_date_arg(val: str) -> date:
    """Parse date from YYYY-MM-DD or DDMMYYYY format."""
    for fmt in ("%Y-%m-%d", "%d%m%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(val.strip(), fmt).date()
        except ValueError:
            pass
    msg = f"Invalid date format: '{val}'. Expected YYYY-MM-DD or DDMMYYYY."
    raise argparse.ArgumentTypeError(msg)


def resolve_folder(folder_str: str) -> Path:
    """Resolve folder path relative to current dir or project root."""
    p = Path(folder_str).resolve()
    if p.is_dir():
        return p
    alt = (Path(__file__).resolve().parent.parent.parent / folder_str).resolve()
    if alt.is_dir():
        return alt
    return p


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Check Bhavcopy CSV file coverage without network requests."
    )
    parser.add_argument(
        "--folder",
        type=str,
        default="data/incoming",
        help="Path to folder containing Bhavcopy CSV files (default: data/incoming)",
    )
    parser.add_argument(
        "--from",
        dest="from_date",
        type=parse_date_arg,
        default=None,
        help="Start date (YYYY-MM-DD). If omitted, earliest date found in folder is used.",
    )
    parser.add_argument(
        "--to",
        dest="to_date",
        type=parse_date_arg,
        default=None,
        help="End date (YYYY-MM-DD). If omitted, latest date found in folder is used.",
    )

    args = parser.parse_args()

    folder_path = resolve_folder(args.folder)
    if not folder_path.is_dir():
        print(f"Error: Folder not found: {folder_path}", file=sys.stderr)
        sys.exit(1)

    all_entries = sorted(list(folder_path.iterdir()), key=lambda x: x.name)

    dates_found: dict[date, list[str]] = defaultdict(list)
    badly_named_files: list[str] = []
    duplicate_files: list[str] = []

    for entry in all_entries:
        if not entry.is_file():
            continue
        fname = entry.name
        match = FILENAME_PATTERN.match(fname)
        if not match:
            badly_named_files.append(fname)
            continue

        day_str, month_str, year_str = match.groups()
        try:
            file_date = date(int(year_str), int(month_str), int(day_str))
            dates_found[file_date].append(fname)
        except ValueError:
            badly_named_files.append(fname)

    # Identify duplicate files for the same date
    for _d, file_list in dates_found.items():
        if len(file_list) > 1:
            duplicate_files.extend(file_list)

    # Determine date range
    start_date = args.from_date
    end_date = args.to_date

    if start_date is None:
        start_date = min(dates_found.keys()) if dates_found else date.today()
    if end_date is None:
        end_date = max(dates_found.keys()) if dates_found else date.today()

    if start_date > end_date:
        print(
            f"Error: --from ({start_date}) cannot be later than --to ({end_date})",
            file=sys.stderr,
        )
        sys.exit(1)

    # Find missing weekdays grouped by month
    missing_by_month: defaultdict[str, list[date]] = defaultdict(list)
    cur = start_date
    while cur <= end_date:
        if cur.weekday() < 5:  # Monday through Friday
            if cur not in dates_found:
                month_key = cur.strftime("%Y-%m")
                missing_by_month[month_key].append(cur)
        cur += timedelta(days=1)

    # Query database for dates already in bhavcopy_rows
    with engine.connect() as conn:
        db_count_query = text("SELECT COUNT(DISTINCT trade_date) FROM bhavcopy_rows;")
        db_days = conn.execute(db_count_query).scalar() or 0

    needed_days = max(0, 150 - db_days)

    # Output results
    print("=== BHAVCOPY COVERAGE REPORT ===")
    print(f"Folder: {folder_path}")
    print(f"Date Range: {start_date} to {end_date}")
    print(f"Valid CSV files found: {sum(len(v) for v in dates_found.values())}")
    print(f"Distinct dates found: {len(dates_found)}")

    # Badly named files
    if badly_named_files:
        print(f"\n[!] Badly named files ({len(badly_named_files)}):")
        for f in badly_named_files:
            print(f"  - {f}")
    else:
        print("\nBadly named files: None")

    # Duplicates
    if duplicate_files:
        print(f"\n[!] Duplicate files for same date ({len(duplicate_files)}):")
        for f in duplicate_files:
            print(f"  - {f}")
    else:
        print("Duplicate files: None")

    # Missing weekdays grouped by month
    total_missing_weekdays = sum(len(days) for days in missing_by_month.values())
    print(f"\nWeekdays without a file ({total_missing_weekdays} total, grouped by month):")
    if not missing_by_month:
        print("  All weekdays in range have a file.")
    else:
        for month_key in sorted(missing_by_month.keys()):
            days = missing_by_month[month_key]
            days_str = ", ".join(d.strftime("%Y-%m-%d (%a)") for d in days)
            print(f"  {month_key} ({len(days)} missing): {days_str}")

    # Trading days target status
    print("\n=== TRADING DAYS TARGET STATUS ===")
    print(f"Distinct trade dates in bhavcopy_rows: {db_days}")
    print("Target trading days: 150")
    print(f"More trading days needed to reach 150: {needed_days}")


if __name__ == "__main__":
    main()
