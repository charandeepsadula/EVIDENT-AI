import asyncio
import re
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from arq.connections import RedisSettings, create_pool
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile, status

from app.core.config import settings
from app.forensics.processors import analyze_image, analyze_image_with_ai, sha256_file
from app.schemas.investigations import InvestigationCreate
from app.schemas.uploads import UploadInvestigationCreate, UploadMetadata
from app.security.auth import CurrentUser
from app.services import local_store
from app.services.supabase import rest_request

router = APIRouter(prefix="/investigations", tags=["investigations"])
LOCAL_IMAGE_MAX_BYTES = 25 * 1024 * 1024


def _redis_settings() -> RedisSettings:
    if not settings.redis_url:
        raise HTTPException(status_code=503, detail={"code": "WORKER_NOT_CONFIGURED", "message": "Background processing is not configured."})
    parsed = urlparse(settings.redis_url)
    return RedisSettings(host=parsed.hostname or "localhost", port=parsed.port or 6379, database=int(parsed.path.lstrip("/") or "0"), username=parsed.username, password=parsed.password, ssl=parsed.scheme == "rediss", ssl_check_hostname=parsed.scheme == "rediss")


def _check_services() -> None:
    missing = []
    for key, value in (("SUPABASE_SERVICE_ROLE_KEY", settings.supabase_service_role_key), ("REDIS_URL", settings.redis_url), ("GEMINI_API_KEY", settings.gemini_api_key), ("TAVILY_API_KEY", settings.tavily_api_key)):
        if not value:
            missing.append(key)
    if missing:
        raise HTTPException(status_code=503, detail={"code": "INVESTIGATION_SERVICES_NOT_CONFIGURED", "message": "Configure required backend services before starting an investigation.", "missing": missing})


def _check_worker_services() -> None:
    missing = [name for name, value in (("SUPABASE_SERVICE_ROLE_KEY", settings.supabase_service_role_key), ("REDIS_URL", settings.redis_url)) if not value]
    if missing:
        raise HTTPException(status_code=503, detail={"code": "WORKER_NOT_CONFIGURED", "message": "Configure the database worker and queue before starting media analysis.", "missing": missing})


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_investigation(body: InvestigationCreate, user: CurrentUser, background_tasks: BackgroundTasks):
    if settings.local_dev_mode:
        title = body.title or body.content[:100]
        row = local_store.create_investigation(str(user.id), title, body.submitted_type, body.content, body.language)
        background_tasks.add_task(local_store.run_local_analysis, row["id"], str(user.id), body.submitted_type, body.content, body.language)
        return row
    _check_services()
    investigation_id = str(uuid4())
    content = body.content
    title = body.title or (content[:100] if body.submitted_type == "text" else content[:100])
    payload = {"owner_id": str(user.id), "submitted_type": body.submitted_type, "submitted_content": content, "title": title, "language": body.language}
    rows = await rest_request("POST", "investigations", token=user.access_token, payload=payload, prefer="return=representation")
    if not rows:
        raise HTTPException(status_code=502, detail={"code": "INVESTIGATION_CREATE_FAILED", "message": "Investigation could not be saved."})
    investigation_id = rows[0]["id"]
    pool = None
    try:
        pool = await create_pool(_redis_settings())
        await pool.enqueue_job("run_investigation", investigation_id, str(user.id), body.submitted_type, content, body.language, _job_id=f"investigation:{investigation_id}")
    except Exception as exc:
        await rest_request("DELETE", "investigations", token=user.access_token, params={"id": f"eq.{investigation_id}"})
        raise HTTPException(status_code=503, detail={"code": "WORKER_UNAVAILABLE", "message": "The investigation worker could not be reached. Nothing was queued."}) from exc
    finally:
        if pool is not None:
            await pool.aclose()
    return rows[0]


@router.post("/local-image", status_code=status.HTTP_201_CREATED)
async def upload_local_image(user: CurrentUser, file: UploadFile = File(...)):
    if not settings.local_dev_mode:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Local image upload is available only in local MVP mode."})
    allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/tiff": ".tiff"}
    mime_type = file.content_type or ""
    if mime_type not in allowed:
        raise HTTPException(status_code=415, detail={"code": "UNSUPPORTED_IMAGE", "message": "Upload a JPEG, PNG, WebP, or TIFF image."})
    data = await file.read(LOCAL_IMAGE_MAX_BYTES + 1)
    if not data or len(data) > LOCAL_IMAGE_MAX_BYTES:
        raise HTTPException(status_code=413, detail={"code": "IMAGE_TOO_LARGE", "message": "Image must be smaller than 25 MB."})
    base = Path(settings.local_database_path).resolve().parent / "uploads"
    base.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid4()}{allowed[mime_type]}"
    path = (base / safe_name).resolve()
    if base.resolve() not in path.parents:
        raise HTTPException(status_code=400, detail={"code": "INVALID_FILE_PATH", "message": "Invalid file path."})
    path.write_bytes(data)
    try:
        format_check = analyze_image(path)
        expected_format = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP", "image/tiff": "TIFF"}[mime_type]
        if format_check["metadata"].get("format") != expected_format:
            raise ValueError("File contents do not match the declared image type.")
    except Exception:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail={"code": "INVALID_IMAGE", "message": "The uploaded file could not be decoded as a supported image."})
    try:
        result = await analyze_image_with_ai(path, mime_type)
        original_name = (file.filename or "image").replace("\\", "/").split("/")[-1]
        row = local_store.save_local_image(str(user.id), original_name, mime_type, len(data), path, result["findings"], sha256_file(path), result["perceptual_hash"])
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail={"code": "IMAGE_PERSIST_FAILED", "message": "Image analysis ran, but the local record could not be saved."}) from exc
    return {"id": row["id"], "status": row["status"]}


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def create_upload_investigation(body: UploadInvestigationCreate, user: CurrentUser):
    if settings.local_dev_mode:
        raise HTTPException(status_code=422, detail={"code": "MVP_IMAGE_UPLOAD", "message": "Local MVP mode supports image uploads only. Use the image lab."})
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise HTTPException(status_code=503, detail={"code": "DATABASE_NOT_CONFIGURED", "message": "Supabase is not configured."})
    payload = {"owner_id": str(user.id), "submitted_type": body.submitted_type, "title": body.title or f"{body.submitted_type.title()} investigation", "language": body.language}
    rows = await rest_request("POST", "investigations", token=user.access_token, payload=payload, prefer="return=representation")
    if not rows:
        raise HTTPException(status_code=502, detail={"code": "INVESTIGATION_CREATE_FAILED", "message": "Investigation could not be saved."})
    return rows[0]


@router.post("/{investigation_id}/files", status_code=status.HTTP_201_CREATED)
async def register_uploaded_file(investigation_id: str, body: UploadMetadata, user: CurrentUser):
    parent = await rest_request("GET", "investigations", token=user.access_token, params={"id": f"eq.{investigation_id}", "select": "id,owner_id,submitted_type", "limit": "1"})
    if not parent:
        raise HTTPException(status_code=404, detail={"code": "INVESTIGATION_NOT_FOUND", "message": "Investigation was not found."})
    if parent[0]["owner_id"] != str(user.id):
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only the investigation owner can add files."})
    if body.storage_path.split("/", 1)[0] != investigation_id or len(body.storage_path.split("/")) != 2:
        raise HTTPException(status_code=422, detail={"code": "INVALID_STORAGE_PATH", "message": "File must be stored in its investigation folder."})
    object_name = body.storage_path.split("/", 1)[1]
    if not re.fullmatch(r"[0-9a-fA-F-]{36}\.[a-z0-9]{2,8}", object_name):
        raise HTTPException(status_code=422, detail={"code": "INVALID_STORAGE_PATH", "message": "File storage name is not valid."})
    expected = {"image": "image/", "video": "video/", "audio": "audio/", "document": ("application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}.get(parent[0]["submitted_type"])
    if expected is None or (isinstance(expected, str) and not body.mime_type.startswith(expected)) or (isinstance(expected, tuple) and body.mime_type not in expected):
        raise HTTPException(status_code=422, detail={"code": "FILE_TYPE_MISMATCH", "message": "File type does not match the investigation type."})
    file_id = str(uuid4())
    row = {"id": file_id, "investigation_id": investigation_id, "owner_id": str(user.id), "storage_path": body.storage_path, "original_filename": body.original_filename, "mime_type": body.mime_type, "size_bytes": body.size_bytes}
    rows = await rest_request("POST", "uploaded_files", admin=True, payload=row, prefer="return=representation")
    if not rows:
        raise HTTPException(status_code=502, detail={"code": "FILE_RECORD_FAILED", "message": "Uploaded file metadata could not be saved."})
    return rows[0]


@router.post("/{investigation_id}/analyze-media", status_code=status.HTTP_202_ACCEPTED)
async def analyze_media(investigation_id: str, user: CurrentUser):
    _check_worker_services()
    parent = await rest_request("GET", "investigations", token=user.access_token, params={"id": f"eq.{investigation_id}", "select": "id,owner_id,submitted_type,status", "limit": "1"})
    if not parent:
        raise HTTPException(status_code=404, detail={"code": "INVESTIGATION_NOT_FOUND", "message": "Investigation was not found."})
    if parent[0]["owner_id"] != str(user.id):
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only the investigation owner can analyze this file."})
    if parent[0]["submitted_type"] not in {"image", "video", "audio", "document"}:
        raise HTTPException(status_code=422, detail={"code": "NOT_MEDIA_INVESTIGATION", "message": "This investigation is not a media upload."})
    files = await rest_request("GET", "uploaded_files", admin=True, params={"investigation_id": f"eq.{investigation_id}", "owner_id": f"eq.{user.id}", "select": "id", "limit": "1"})
    if not files:
        raise HTTPException(status_code=409, detail={"code": "FILE_NOT_REGISTERED", "message": "Upload a file before starting analysis."})
    redis = None
    try:
        redis = await create_pool(_redis_settings())
        await redis.enqueue_job("run_media_investigation", investigation_id, str(user.id), files[0]["id"], _job_id=f"media:{investigation_id}")
    except Exception as exc:
        await rest_request("PATCH", "investigations", admin=True, params={"id": f"eq.{investigation_id}"}, payload={"status": "FAILED", "current_stage": "Worker unavailable", "error_code": "WORKER_UNAVAILABLE"}, prefer="return=minimal")
        raise HTTPException(status_code=503, detail={"code": "WORKER_UNAVAILABLE", "message": "The media worker could not be reached."}) from exc
    finally:
        if redis is not None:
            await redis.aclose()
    return {"id": investigation_id, "status": "QUEUED"}


@router.get("")
async def list_investigations(user: CurrentUser):
    if settings.local_dev_mode:
        return local_store.list_investigations(str(user.id))
    return await rest_request("GET", "investigations", token=user.access_token, params={"select": "id,title,submitted_type,status,progress,current_stage,created_at,updated_at,completed_at", "order": "created_at.desc", "limit": "100"})


@router.get("/{investigation_id}")
async def get_investigation(investigation_id: str, user: CurrentUser):
    if settings.local_dev_mode:
        return local_store.get_investigation(investigation_id, str(user.id))
    rows = await rest_request("GET", "investigations", token=user.access_token, params={"id": f"eq.{investigation_id}", "select": "*", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail={"code": "INVESTIGATION_NOT_FOUND", "message": "Investigation was not found."})
    return rows[0]


@router.get("/{investigation_id}/results")
async def investigation_results(investigation_id: str, user: CurrentUser):
    if settings.local_dev_mode:
        return local_store.list_results(investigation_id, str(user.id))
    parent = await rest_request("GET", "investigations", token=user.access_token, params={"id": f"eq.{investigation_id}", "select": "id", "limit": "1"})
    if not parent:
        raise HTTPException(status_code=404, detail={"code": "INVESTIGATION_NOT_FOUND", "message": "Investigation was not found."})
    common = {"investigation_id": f"eq.{investigation_id}"}
    claims, sources, evidence, runs, events, forensic, files = await asyncio.gather(
        rest_request("GET", "claims", token=user.access_token, params={**common, "select": "*", "order": "created_at.asc"}),
        rest_request("GET", "sources", token=user.access_token, params={**common, "select": "*", "order": "retrieved_at.asc"}),
        rest_request("GET", "evidence", token=user.access_token, params={**common, "select": "*", "order": "created_at.asc"}),
        rest_request("GET", "agent_runs", token=user.access_token, params={**common, "select": "*", "order": "created_at.asc"}),
        rest_request("GET", "investigation_events", token=user.access_token, params={**common, "select": "*", "order": "created_at.asc"}),
        rest_request("GET", "forensic_results", token=user.access_token, params={**common, "select": "*", "order": "created_at.asc"}),
        rest_request("GET", "uploaded_files", token=user.access_token, params={**common, "select": "id,original_filename,mime_type,size_bytes,sha256,perceptual_hash,extracted_text,created_at", "order": "created_at.asc"}),
    )
    return {"claims": claims, "sources": sources, "evidence": evidence, "agent_runs": runs, "events": events, "forensic_results": forensic, "uploaded_files": files}


@router.get("/{investigation_id}/evidence")
async def investigation_evidence(investigation_id: str, user: CurrentUser):
    result = await investigation_results(investigation_id, user)
    if settings.local_dev_mode:
        sources = {row["id"]: row for row in result["sources"]}
        claims = {row["id"]: row for row in result["claims"]}
        return [{**item, "source": sources.get(item.get("source_id")), "claim": claims.get(item.get("claim_id"))} for item in result["evidence"]]
    sources = {row["id"]: row for row in result["sources"]}
    claims = {row["id"]: row for row in result["claims"]}
    return [{**item, "source": sources.get(item.get("source_id")), "claim": claims.get(item.get("claim_id"))} for item in result["evidence"]]


@router.get("/{investigation_id}/graph")
async def investigation_graph(investigation_id: str, user: CurrentUser):
    result = await investigation_results(investigation_id, user)
    nodes = ([{"id": row["id"], "type": "claim", "label": row["text"]} for row in result["claims"]]
             + [{"id": row["id"], "type": "source", "label": row.get("title") or row.get("publisher") or row["url"], "url": row["url"]} for row in result["sources"]])
    edges = [{"from": row["claim_id"], "to": row["source_id"], "relationship": row["direction"], "evidence_id": row["id"]} for row in result["evidence"] if row.get("claim_id") and row.get("source_id")]
    return {"nodes": nodes, "edges": edges}


@router.get("/{investigation_id}/timeline")
async def investigation_timeline(investigation_id: str, user: CurrentUser):
    result = await investigation_results(investigation_id, user)
    appearances = [{"type": "source", "timestamp": source.get("published_at") or source.get("retrieved_at"), "title": source.get("title") or source["url"], "url": source["url"], "date_is_publication": bool(source.get("published_at"))} for source in result["sources"]]
    return {"events": result["events"], "source_appearances": appearances}


@router.post("/{investigation_id}/cancel")
async def cancel_investigation(investigation_id: str, user: CurrentUser):
    if settings.local_dev_mode:
        item = local_store.get_investigation(investigation_id, str(user.id))
        if item["status"] not in {"QUEUED", "PROCESSING"}:
            raise HTTPException(status_code=409, detail={"code": "INVESTIGATION_NOT_ACTIVE", "message": "This investigation is not running."})
        local_store.update_status(investigation_id, str(user.id), "CANCELLED", progress=100, stage="Cancelled")
        return local_store.get_investigation(investigation_id, str(user.id))
    rows = await rest_request("GET", "investigations", token=user.access_token, params={"id": f"eq.{investigation_id}", "select": "id,owner_id,status", "limit": "1"})
    if not rows:
        raise HTTPException(status_code=404, detail={"code": "INVESTIGATION_NOT_FOUND", "message": "Investigation was not found."})
    if rows[0]["owner_id"] != str(user.id):
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only the investigation owner can cancel it."})
    if rows[0]["status"] in {"COMPLETED", "PARTIALLY_COMPLETED", "FAILED", "CANCELLED"}:
        raise HTTPException(status_code=409, detail={"code": "INVESTIGATION_NOT_ACTIVE", "message": "This investigation is not running."})
    result = await rest_request("PATCH", "investigations", admin=True, params={"id": f"eq.{investigation_id}", "owner_id": f"eq.{user.id}", "status": f"in.({','.join(['QUEUED','PROCESSING','ANALYZING','EVIDENCE_REVIEW','NEEDS_REVIEW'])})"}, payload={"status": "CANCELLED", "current_stage": "Cancelled"}, prefer="return=representation")
    return result[0] if result else {"id": investigation_id, "status": "CANCELLED"}


@router.delete("/{investigation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_unqueued_investigation(investigation_id: str, user: CurrentUser):
    if settings.local_dev_mode:
        row = local_store.get_investigation(investigation_id, str(user.id))
        if row["status"] in {"PROCESSING", "ANALYZING"}:
            raise HTTPException(status_code=409, detail={"code": "INVESTIGATION_ACTIVE", "message": "Cannot delete an investigation currently in progress."})
        local_store.delete_investigation(investigation_id, str(user.id))
        return None
    rows = await rest_request("GET", "investigations", token=user.access_token, params={"id": f"eq.{investigation_id}", "select": "id,owner_id,status", "limit": "1"})
    if not rows:
        return None
    if rows[0]["owner_id"] != str(user.id):
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Only the investigation owner can delete it."})
    if rows[0]["status"] not in {"QUEUED", "FAILED"}:
        raise HTTPException(status_code=409, detail={"code": "INVESTIGATION_ACTIVE", "message": "Only unqueued or failed investigations can be deleted here."})
    await rest_request("DELETE", "investigations", token=user.access_token, params={"id": f"eq.{investigation_id}"})
    return None
