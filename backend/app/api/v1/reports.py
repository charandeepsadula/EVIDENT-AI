from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.api.v1.investigations import get_investigation, investigation_results
from app.security.auth import CurrentUser
from app.services.supabase import rest_request
from app.core.config import settings
from app.services import local_store

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportCreate(BaseModel):
    investigation_id: UUID


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_report(body: ReportCreate, user: CurrentUser):
    if settings.local_dev_mode:
        investigation = local_store.get_investigation(str(body.investigation_id), str(user.id))
        if investigation["status"] in {"QUEUED", "PROCESSING", "ANALYZING", "EVIDENCE_REVIEW"}:
            raise HTTPException(status_code=409, detail={"code": "INVESTIGATION_IN_PROGRESS", "message": "Wait for processing to finish before generating a report."})
        return local_store.save_report(str(body.investigation_id), str(user.id))
    investigation = await get_investigation(str(body.investigation_id), user)
    if investigation["status"] in {"QUEUED", "PROCESSING", "ANALYZING", "EVIDENCE_REVIEW"}:
        raise HTTPException(status_code=409, detail={"code": "INVESTIGATION_IN_PROGRESS", "message": "Wait for processing to finish before generating a report."})
    results = await investigation_results(str(body.investigation_id), user)
    previous = await rest_request("GET", "reports", token=user.access_token, params={"investigation_id": f"eq.{body.investigation_id}", "format": "eq.json", "select": "version", "order": "version.desc", "limit": "1"})
    version = int(previous[0]["version"]) + 1 if previous else 1
    report_id = str(uuid4())
    report = {
        "report_id": report_id,
        "version": version,
        "generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "investigation": {key: investigation.get(key) for key in ("id", "title", "submitted_type", "submitted_content", "status", "created_at", "completed_at", "language")},
        "executive_summary": "This report reflects only the evidence and analysis persisted for this investigation. Review its limitations and source links before relying on any conclusion.",
        "claims": results["claims"],
        "sources": results["sources"],
        "evidence": results["evidence"],
        "forensic_results": results["forensic_results"],
        "agent_runs": results["agent_runs"],
        "events": results["events"],
        "limitations": ["Source availability is limited to the configured research provider.", "Forensic indicators are not proof of authenticity or manipulation.", "Human review may still be required."],
    }
    row = {"id": report_id, "investigation_id": str(body.investigation_id), "version": version, "format": "json", "status": "ready", "report_json": report}
    await rest_request("POST", "reports", admin=True, payload=row, prefer="return=minimal")
    return row


@router.get("")
async def list_reports(user: CurrentUser):
    if settings.local_dev_mode:
        return local_store.list_reports(str(user.id))
    return await rest_request("GET", "reports", token=user.access_token, params={"select": "id,investigation_id,version,format,status,created_at", "order": "created_at.desc", "limit": "100"})


@router.get("/{report_id}")
async def get_report(report_id: UUID, user: CurrentUser):
    if settings.local_dev_mode:
        return local_store.get_report(str(report_id), str(user.id))
    rows = await rest_request("GET", "reports", token=user.access_token, params={"id": f"eq.{report_id}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail={"code": "REPORT_NOT_FOUND", "message": "Report was not found."})
    return rows[0]
