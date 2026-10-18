"""Incoming Bhavcopy file normalization and deduplication logic."""

from __future__ import annotations

import csv
import hashlib
import re
import shutil
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

FILENAME_DATE_PATTERN = re.compile(r"BhavCopyDateWise_(\d{2})(\d{2})(\d{4})")
DATE_FORMATS = ("%d %b %Y", "%d-%b-%Y", "%Y-%m-%d", "%d/%m/%Y")


@dataclass
class FileInfo:
    path: Path
    filename: str
    content_date: date
    name_date: date | None
    sha256: str
    target_name: str


@dataclass
class Action:
    file_info: FileInfo
    action_type: str  # "KEEP", "MOVE_DUPLICATE", "RENAME"
    target_path: Path | None
    description: str


@dataclass
class PlanResult:
    actions: list[Action]
    conflicts: list[str]

    @property
    def has_conflicts(self) -> bool:
        return len(self.conflicts) > 0


def extract_name_date(filename: str) -> date | None:
    """Extract date from filename matching BhavCopyDateWise_DDMMYYYY."""
    m = FILENAME_DATE_PATTERN.search(filename)
    if not m:
        return None
    day_str, month_str, year_str = m.groups()
    try:
        return date(int(year_str), int(month_str), int(day_str))
    except ValueError:
        return None


def read_content_date_and_sha(path: Path) -> tuple[date, str]:
    """Read content date from Date column and compute sha256."""
    content_bytes = path.read_bytes()
    sha = hashlib.sha256(content_bytes).hexdigest()

    text_content = content_bytes.decode("utf-8", errors="replace")
    reader = csv.DictReader(text_content.splitlines())

    dates: set[date] = set()
    for row in reader:
        raw_val = (row.get("Date") or "").strip().strip('"')
        if not raw_val:
            continue
        parsed: date | None = None
        for fmt in DATE_FORMATS:
            try:
                parsed = datetime.strptime(raw_val, fmt).date()
                break
            except ValueError:
                pass
        if parsed is None:
            msg = f"Unparseable date '{raw_val}' in file {path.name}"
            raise ValueError(msg)
        dates.add(parsed)

    if not dates:
        msg = f"No valid Date rows found in {path.name}"
        raise ValueError(msg)
    if len(dates) > 1:
        msg = f"Multiple dates found in {path.name}: {dates}"
        raise ValueError(msg)

    return next(iter(dates)), sha


def inspect_file(path: Path) -> FileInfo:
    """Inspect file path and extract metadata."""
    name_date = extract_name_date(path.name)
    content_date, sha = read_content_date_and_sha(path)
    target_name = f"BhavCopyDateWise_{content_date.strftime('%d%m%Y')}.csv"
    return FileInfo(
        path=path,
        filename=path.name,
        content_date=content_date,
        name_date=name_date,
        sha256=sha,
        target_name=target_name,
    )


def plan_normalizations(
    files: Sequence[FileInfo],
    incoming_dir: Path,
    rejected_dir: Path,
) -> PlanResult:
    """Create a normalization plan for a list of inspected files."""
    conflicts: list[str] = []
    actions: list[Action] = []

    # Group by content date
    by_date: defaultdict[date, list[FileInfo]] = defaultdict(list)
    for f in files:
        by_date[f.content_date].append(f)

    # First check for conflicts (different sha for same content date)
    for c_date, flist in by_date.items():
        distinct_shas = {f.sha256 for f in flist}
        if len(distinct_shas) > 1:
            details = [f"{f.filename} (sha256={f.sha256[:10]})" for f in flist]
            conflicts.append(
                f"Conflict on date {c_date}: {len(flist)} files with differing content: "
                + ", ".join(details)
            )

    if conflicts:
        return PlanResult(actions=[], conflicts=conflicts)

    dup_dir = rejected_dir / "duplicates"

    for _c_date, flist in sorted(by_date.items(), key=lambda x: x[0]):
        # All files in flist share identical sha256
        # Find which one is the canonical keeper
        canonical = next((f for f in flist if f.filename == f.target_name), None)
        if canonical is None:
            # None has canonical name, pick the first
            canonical = flist[0]

        for f in flist:
            if f is canonical:
                if f.filename == f.target_name:
                    actions.append(
                        Action(
                            file_info=f,
                            action_type="KEEP",
                            target_path=f.path,
                            description=f"keep (already canonical {f.target_name})",
                        )
                    )
                else:
                    target_path = incoming_dir / f.target_name
                    actions.append(
                        Action(
                            file_info=f,
                            action_type="RENAME",
                            target_path=target_path,
                            description=f"rename -> {f.target_name}",
                        )
                    )
            else:
                # Duplicate of canonical
                target_path = dup_dir / f.filename
                actions.append(
                    Action(
                        file_info=f,
                        action_type="MOVE_DUPLICATE",
                        target_path=target_path,
                        description=(
                            f"duplicate of {canonical.filename} -> "
                            "move to incoming_rejected/duplicates/"
                        ),
                    )
                )

    return PlanResult(actions=actions, conflicts=conflicts)


def execute_plan(plan: PlanResult) -> None:
    """Execute the planned actions in safe order (moves to rejected first, then renames)."""
    if plan.has_conflicts:
        msg = "Cannot execute plan with unresolved conflicts"
        raise RuntimeError(msg)

    # 1. Ensure rejected directory exists
    duplicates: list[Action] = [a for a in plan.actions if a.action_type == "MOVE_DUPLICATE"]
    renames: list[Action] = [a for a in plan.actions if a.action_type == "RENAME"]

    if duplicates:
        first_target = duplicates[0].target_path
        if first_target:
            first_target.parent.mkdir(parents=True, exist_ok=True)

    # 2. Perform moves of duplicates first to free up names
    for act in duplicates:
        if act.target_path is None:
            continue
        if act.target_path.exists():
            msg = f"Cannot move duplicate: destination already exists: {act.target_path}"
            raise FileExistsError(msg)
        shutil.move(str(act.file_info.path), str(act.target_path))

    # 3. Perform renames
    for act in renames:
        if act.target_path is None:
            continue
        if act.target_path.exists():
            msg = f"Cannot rename: destination already exists: {act.target_path}"
            raise FileExistsError(msg)
        shutil.move(str(act.file_info.path), str(act.target_path))
