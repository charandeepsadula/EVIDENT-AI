from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services import local_store


def test_create_investigation_can_be_retrieved_with_results_and_evidence(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "local_dev_mode", True)
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "local_dev_token", "test-local-token-that-is-at-least-32-characters")
    monkeypatch.setattr(settings, "local_database_path", str(tmp_path / "evident.sqlite3"))
    # Keep the API test independent of provider credentials; persisted workflow output
    # is added below through the same store operation used by local analysis.
    async def no_analysis(*_args, **_kwargs):
        return None

    monkeypatch.setattr(local_store, "run_local_analysis", no_analysis)
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {settings.local_dev_token}"}

    created = client.post(
        "/api/v1/investigations",
        headers=headers,
        json={"submitted_type": "text", "content": "A testable claim", "language": "en"},
    )
    assert created.status_code == 202
    investigation_id = created.json()["id"]

    retrieved = client.get(f"/api/v1/investigations/{investigation_id}", headers=headers)
    assert retrieved.status_code == 200
    assert retrieved.json()["id"] == investigation_id
    assert retrieved.json()["submitted_content"] == "A testable claim"

    local_store.save_workflow(
        investigation_id,
        "00000000-0000-4000-8000-000000000001",
        {
            "claims": ["A testable claim"],
            "sources": [{"url": "https://example.org/source", "title": "Source", "passage": "Relevant passage"}],
            "assessments": [{
                "claim": "A testable claim",
                "verdict": "UNVERIFIED",
                "reasoning_summary": "Test evidence requires review.",
                "confidence": 0.0,
                "supporting_source_urls": ["https://example.org/source"],
            }],
        },
    )

    results = client.get(f"/api/v1/investigations/{investigation_id}/results", headers=headers)
    assert results.status_code == 200
    assert len(results.json()["claims"]) == 1
    assert len(results.json()["sources"]) == 1
    assert len(results.json()["evidence"]) == 1

    evidence = client.get(f"/api/v1/investigations/{investigation_id}/evidence", headers=headers)
    assert evidence.status_code == 200
    assert evidence.json()[0]["source"]["url"] == "https://example.org/source"
    assert evidence.json()[0]["claim"]["text"] == "A testable claim"
