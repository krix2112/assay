"""Tests enforcing single choke point for MCX access and safety guards."""

import ast
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def _extract_string_literals(node: ast.AST) -> list[str]:
    """Extract all string literal values from an AST excluding docstrings."""
    strings: list[str] = []

    # Identify and skip module, class, and function docstrings
    docstring_nodes: set[ast.AST] = set()
    for n in ast.walk(node):
        if isinstance(n, ast.Module | ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            if (
                n.body
                and isinstance(n.body[0], ast.Expr)
                and isinstance(n.body[0].value, ast.Constant)
                and isinstance(n.body[0].value.value, str)
            ):
                docstring_nodes.add(n.body[0].value)

    for n in ast.walk(node):
        if isinstance(n, ast.Constant) and isinstance(n.value, str):
            if n not in docstring_nodes:
                strings.append(n.value)

    return strings


def test_single_choke_point_mcx_url_and_clients():
    """Verify only backend/app/ingest/fetcher.py may reference MCX URL in code.

    Scans backend/ (excluding tests/ and data/quarantine/) and fails if any other file
    contains 'mcxindia.com' in code (excluding comments and docstrings), or imports
    httpx, requests, urllib, or aiohttp to call it.
    """
    backend_dir = Path(__file__).resolve().parent.parent
    excluded_dirs = {
        backend_dir / "tests",
        backend_dir / ".venv",
        backend_dir / ".mypy_cache",
        backend_dir / ".ruff_cache",
        backend_dir / ".pytest_cache",
        backend_dir / "migrations",
    }
    allowed_file = (backend_dir / "app" / "ingest" / "fetcher.py").resolve()

    violations = []
    py_files = [
        p for p in backend_dir.rglob("*.py") if not any(ex in p.parents for ex in excluded_dirs)
    ]

    for py_file in py_files:
        resolved_file = py_file.resolve()
        if "data" in resolved_file.parts and "quarantine" in resolved_file.parts:
            continue
        if resolved_file == allowed_file:
            continue

        source = py_file.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source, filename=str(py_file))
        except SyntaxError:
            continue

        string_literals = _extract_string_literals(tree)
        for s in string_literals:
            if "mcxindia.com" in s.lower():
                violations.append(f"{py_file.relative_to(backend_dir)}: contains 'mcxindia.com'")

        # Check if importing httpx, requests, urllib, aiohttp to call mcxindia.com
        imported_http_clients = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in {"httpx", "requests", "urllib", "aiohttp"}:
                        imported_http_clients.add(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module and any(
                    node.module == m or node.module.startswith(f"{m}.")
                    for m in {"httpx", "requests", "urllib", "aiohttp"}
                ):
                    imported_http_clients.add(node.module.split(".")[0])

        if imported_http_clients:
            # If HTTP clients are imported, verify they are not used against MCX
            for s in string_literals:
                if "mcx" in s.lower():
                    violations.append(
                        f"{py_file.relative_to(backend_dir)}: imports "
                        f"{imported_http_clients} and references '{s}'"
                    )

    msg = "MCX access choke point violated by:\n" + "\n".join(violations)
    assert not violations, msg


def test_no_browser_style_headers():
    """Fail if any file in backend/ sets browser-style headers outside tests/ and quarantine."""
    backend_dir = Path(__file__).resolve().parent.parent
    excluded_dirs = {
        backend_dir / "tests",
        backend_dir / ".venv",
        backend_dir / ".mypy_cache",
        backend_dir / ".ruff_cache",
        backend_dir / ".pytest_cache",
        backend_dir / "migrations",
    }

    # Browser spoofing patterns: Chrome user agent, Sec-Fetch-, Sec-Ch-
    browser_header_pattern = re.compile(
        r"(Chrome/\d+|Sec-Fetch-[A-Za-z0-9\-]+|Sec-Ch-[A-Za-z0-9\-]+|Mozilla/5\.0)",
        re.IGNORECASE,
    )

    violations = []
    py_files = [
        p for p in backend_dir.rglob("*.py") if not any(ex in p.parents for ex in excluded_dirs)
    ]

    for py_file in py_files:
        resolved_file = py_file.resolve()
        if "data" in resolved_file.parts and "quarantine" in resolved_file.parts:
            continue

        source = py_file.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source, filename=str(py_file))
        except SyntaxError:
            continue

        string_literals = _extract_string_literals(tree)
        for s in string_literals:
            if browser_header_pattern.search(s):
                violations.append(
                    f"{py_file.relative_to(backend_dir)}: contains browser header token '{s}'"
                )

    msg = "Browser-style headers found in backend:\n" + "\n".join(violations)
    assert not violations, msg


def test_refuse_live_fetching_in_production(monkeypatch):
    """The app must refuse to start if ENVIRONMENT is production and
    MCX_LIVE_FETCH_ENABLED is true.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "MCX_LIVE_FETCH_ENABLED", True)

    with pytest.raises(
        RuntimeError, match="Automated MCX live fetching is strictly prohibited in production"
    ):
        with TestClient(app):
            pass
