from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)


def test_system_health():
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert data["service"] == "evident-ai-api"
    assert "gemini" in data
    assert "tavily" in data
    assert "database" in data


def test_system_stats_authorized(tmp_path, monkeypatch):
    test_token = "test-local-token-that-is-at-least-32-characters"
    monkeypatch.setattr(settings, "local_dev_mode", True)
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "local_dev_token", test_token)
    monkeypatch.setattr(settings, "local_database_path", str(tmp_path / "evident.sqlite3"))

    headers = {"Authorization": f"Bearer {test_token}"}
    response = client.get("/api/v1/system/stats", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_investigations" in data
    assert "completed_investigations" in data
    assert "failed_investigations" in data
    assert "pending_investigations" in data
    assert "type_counts" in data


def test_evidence_explorer_authorized(tmp_path, monkeypatch):
    test_token = "test-local-token-that-is-at-least-32-characters"
    monkeypatch.setattr(settings, "local_dev_mode", True)
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "local_dev_token", test_token)
    monkeypatch.setattr(settings, "local_database_path", str(tmp_path / "evident.sqlite3"))

    headers = {"Authorization": f"Bearer {test_token}"}
    response = client.get("/api/v1/evidence", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
