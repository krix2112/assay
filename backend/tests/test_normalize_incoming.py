"""Unit tests for incoming Bhavcopy normalizer script."""

import csv
from datetime import date
from pathlib import Path

import pytest

from app.ingest.normalizer import (
    execute_plan,
    inspect_file,
    plan_normalizations,
)


def _create_csv(path: Path, trade_date: str) -> None:
    """Write a minimal valid MCX Bhavcopy CSV."""
    rows = [
        [
            "Date",
            "Instrument Name",
            "Symbol",
            "Expiry Date",
            "Option Type",
            "Strike Price",
            "Open",
            "High",
            "Low",
            "Close",
            "Previous Close",
            "Volume(Lots)",
            "Volume(In 000's)",
            "Value(Lacs)",
            "Open Interest(Lots)",
        ],
        [
            trade_date,
            "FUTCOM",
            "GOLDM",
            "05NOV2026",
            "-",
            "0",
            "75000",
            "75500",
            "74800",
            "75200",
            "75100",
            "100",
            "100",
            "750",
            "500",
        ],
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)


def test_normalize_canonical_kept(tmp_path: Path) -> None:
    incoming = tmp_path / "incoming"
    rejected = tmp_path / "rejected"
    incoming.mkdir()

    f1 = incoming / "BhavCopyDateWise_08102026.csv"
    _create_csv(f1, "08 Oct 2026")

    info = inspect_file(f1)
    assert info.content_date == date(2026, 10, 8)
    assert info.name_date == date(2026, 10, 8)

    plan = plan_normalizations([info], incoming, rejected)
    assert not plan.has_conflicts
    assert len(plan.actions) == 1
    assert plan.actions[0].action_type == "KEEP"


def test_normalize_rename_when_target_free(tmp_path: Path) -> None:
    incoming = tmp_path / "incoming"
    rejected = tmp_path / "rejected"
    incoming.mkdir()

    # File name says 07102026, but content is 08 Oct 2026
    f1 = incoming / "BhavCopyDateWise_07102026.csv"
    _create_csv(f1, "08 Oct 2026")

    info = inspect_file(f1)
    plan = plan_normalizations([info], incoming, rejected)
    assert not plan.has_conflicts
    assert len(plan.actions) == 1
    assert plan.actions[0].action_type == "RENAME"
    assert plan.actions[0].target_path == incoming / "BhavCopyDateWise_08102026.csv"

    execute_plan(plan)
    assert not f1.exists()
    assert (incoming / "BhavCopyDateWise_08102026.csv").exists()


def test_normalize_duplicate_identical_content(tmp_path: Path) -> None:
    incoming = tmp_path / "incoming"
    rejected = tmp_path / "rejected"
    incoming.mkdir()

    # Canonical file and duplicate file with suffix (1)
    f_canon = incoming / "BhavCopyDateWise_08102026.csv"
    f_dup = incoming / "BhavCopyDateWise_08102026 (1).csv"
    _create_csv(f_canon, "08 Oct 2026")
    _create_csv(f_dup, "08 Oct 2026")  # Identical content

    info1 = inspect_file(f_canon)
    info2 = inspect_file(f_dup)

    plan = plan_normalizations([info1, info2], incoming, rejected)
    assert not plan.has_conflicts
    assert len(plan.actions) == 2

    canon_act = next(a for a in plan.actions if a.file_info.filename == f_canon.name)
    dup_act = next(a for a in plan.actions if a.file_info.filename == f_dup.name)

    assert canon_act.action_type == "KEEP"
    assert dup_act.action_type == "MOVE_DUPLICATE"
    assert dup_act.target_path == rejected / "duplicates" / f_dup.name

    execute_plan(plan)
    assert f_canon.exists()
    assert not f_dup.exists()
    assert (rejected / "duplicates" / f_dup.name).exists()


def test_normalize_conflict_different_sha(tmp_path: Path) -> None:
    incoming = tmp_path / "incoming"
    rejected = tmp_path / "rejected"
    incoming.mkdir()

    f1 = incoming / "BhavCopyDateWise_08102026.csv"
    f2 = incoming / "BhavCopyDateWise_08102026 (1).csv"
    _create_csv(f1, "08 Oct 2026")

    # f2 has same date but different rows / volume
    with f2.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Date", "Instrument Name", "Symbol", "Expiry Date", "Close"])
        writer.writerow(["08 Oct 2026", "FUTCOM", "GOLDM", "05NOV2026", "76000"])

    info1 = inspect_file(f1)
    info2 = inspect_file(f2)

    plan = plan_normalizations([info1, info2], incoming, rejected)
    assert plan.has_conflicts
    assert len(plan.conflicts) == 1
    assert "Conflict on date 2026-10-08" in plan.conflicts[0]

    with pytest.raises(RuntimeError, match="unresolved conflicts"):
        execute_plan(plan)
