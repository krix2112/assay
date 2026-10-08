"""Tests for the /health endpoint."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint_db_up() -> None:
    """Test /health endpoint when database connectivity succeeds."""
    with patch("app.api.health.check_database_connection", return_value=True):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "environment" in data
        assert data["database"] == "up"


def test_health_endpoint_db_down() -> None:
    """Test /health endpoint when database connectivity fails."""
    with patch("app.api.health.check_database_connection", return_value=False):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "environment" in data
        assert data["database"] == "down"
