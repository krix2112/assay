"""CLI script to normalize incoming MCX Bhavcopy filenames and filter duplicates.

Target filename pattern: BhavCopyDateWise_<DDMMYYYY of CONTENT date>.csv
Dry-run by default; use --apply to execute moves and renames.
Never deletes any files. Moves duplicates to data/incoming_rejected/duplicates/.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.ingest.normalizer import (
    FileInfo,
    execute_plan,
    inspect_file,
    plan_normalizations,
)


def resolve_folder(folder_str: str) -> Path:
    p = Path(folder_str).resolve()
    if p.is_dir():
        return p
    alt = (Path(__file__).resolve().parent.parent.parent / folder_str).resolve()
    if alt.is_dir():
        return alt
    return p


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize MCX Bhavcopy filenames and filter duplicates in data/incoming."
    )
    parser.add_argument(
        "--folder",
        type=str,
        default="data/incoming",
        help="Path to folder containing CSV files (default: data/incoming)",
    )
    parser.add_argument(
        "--rejected-dir",
        type=str,
        default="data/incoming_rejected",
        help="Path to directory for rejected/duplicate files (default: data/incoming_rejected)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Apply planned moves and renames. Defaults to dry-run.",
    )

    args = parser.parse_args()

    incoming_dir = resolve_folder(args.folder)
    if not incoming_dir.is_dir():
        print(f"Error: Folder not found: {incoming_dir}", file=sys.stderr)
        sys.exit(1)

    rejected_dir = Path(args.rejected_dir).resolve()
    if not rejected_dir.is_absolute() or not rejected_dir.parent.is_dir():
        alt_rej = (Path(__file__).resolve().parent.parent.parent / args.rejected_dir).resolve()
        rejected_dir = alt_rej

    csv_paths = sorted(
        [p for p in incoming_dir.iterdir() if p.is_file() and p.suffix.lower() == ".csv"]
    )

    if not csv_paths:
        print(f"No CSV files found in {incoming_dir}")
        sys.exit(0)

    # Inspect all files
    inspected_files: list[FileInfo] = []
    for p in csv_paths:
        try:
            inspected_files.append(inspect_file(p))
        except Exception as e:
            print(f"Error reading {p.name}: {e}", file=sys.stderr)
            sys.exit(1)

    # Create plan
    plan = plan_normalizations(inspected_files, incoming_dir, rejected_dir)

    print("=== INCOMING FOLDER NORMALIZATION PLAN ===")
    print(f"Directory: {incoming_dir}")
    print(f"Total CSV files inspected: {len(inspected_files)}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}\n")

    # Check conflicts
    if plan.has_conflicts:
        print(
            "STOP: Conflicts detected (different sha256 for same content date):",
            file=sys.stderr,
        )
        for c in plan.conflicts:
            print(f"  [!] {c}", file=sys.stderr)
        print("\nNo changes made.", file=sys.stderr)
        sys.exit(1)

    # Print one line per file: name, content date, name date, sha256, proposed action
    for act in sorted(plan.actions, key=lambda a: a.file_info.filename):
        fi = act.file_info
        nd_str = fi.name_date.strftime("%Y-%m-%d") if fi.name_date else "None"
        cd_str = fi.content_date.strftime("%Y-%m-%d")
        print(
            f"{fi.filename} | content_date={cd_str} | name_date={nd_str} | "
            f"sha256={fi.sha256[:10]} | action={act.description}"
        )

    # Summary
    keep_count = sum(1 for a in plan.actions if a.action_type == "KEEP")
    move_count = sum(1 for a in plan.actions if a.action_type == "MOVE_DUPLICATE")
    rename_count = sum(1 for a in plan.actions if a.action_type == "RENAME")

    print("\nSummary:")
    print(f"  Keep (already canonical): {keep_count}")
    print(f"  Rename:                   {rename_count}")
    print(f"  Move to duplicates:       {move_count}")

    if args.apply:
        print("\nApplying plan...")
        execute_plan(plan)
        print("Plan applied successfully.")
    else:
        print("\nDry run only. Run with --apply to execute.")


if __name__ == "__main__":
    main()
