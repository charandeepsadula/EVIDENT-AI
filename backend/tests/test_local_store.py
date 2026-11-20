import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services import local_store


@pytest.fixture
def local_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "local_database_path", str(tmp_path / "evident.sqlite3"))
    return "00000000-0000-4000-8000-000000000001"


def test_local_investigation_persists_and_is_owner_scoped(local_db):
    item = local_store.create_investigation(local_db, "Test claim", "text", "A test statement", "en")
    assert item["status"] == "QUEUED"
    assert local_store.list_investigations(local_db)[0]["id"] == item["id"]
    with pytest.raises(HTTPException) as error:
        local_store.get_investigation(item["id"], "00000000-0000-4000-8000-000000000002")
    assert error.value.status_code == 404


def test_failed_investigation_can_be_exported_without_fabricated_claims(local_db):
    item = local_store.create_investigation(local_db, "No-provider example", "text", "A submitted statement", "en")
    local_store.update_status(item["id"], local_db, "FAILED", progress=100, stage="Provider unavailable", error_code="GEMINI_NOT_CONFIGURED", error_message="Gemini is not configured.")
    report = local_store.save_report(item["id"], local_db)
    saved = local_store.get_report(report["id"], local_db)
    assert saved["report_json"]["claims"] == []
    assert saved["report_json"]["investigation"]["status"] == "FAILED"


@pytest.mark.asyncio
async def test_local_analysis_persists_stage_progress_without_claim_results(local_db, monkeypatch):
    from app.agents import investigation_graph

    item = local_store.create_investigation(local_db, "Progress check", "text", "A statement", "en")

    class EmptyWorkflow:
        async def ainvoke(self, state):
            callback = state["progress_callback"]
            for stage in ("claim_extraction", "research", "evidence_evaluation"):
                await callback("start", stage, None)
                await callback("complete", stage, {})
            return {"claims": [], "sources": [], "assessments": []}

    monkeypatch.setattr(investigation_graph, "build_investigation_graph", EmptyWorkflow)
    await local_store.run_local_analysis(item["id"], local_db, "text", "A statement", "en")

    results = local_store.list_results(item["id"], local_db)
    assert [run["status"] for run in results["agent_runs"]] == ["COMPLETED"] * 3
    assert [event["message"] for event in results["events"] if event["event_type"] == "agent_started"] == [
        "Claim extraction started.",
        "Source research started.",
        "Evidence evaluation started.",
    ]
    assert results["claims"] == []
    assert results["evidence"] == []
