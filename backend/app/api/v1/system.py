import time
from typing import Any
import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.config import settings
from app.security.auth import CurrentUser
from app.services import local_store

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    local_dev_mode: bool
    database: dict[str, Any]
    gemini: dict[str, Any]
    tavily: dict[str, Any]
    model: str


@router.get("/system/health", response_model=HealthResponse)
async def system_health():
    # Database check
    db_ok = True
    db_detail = "SQLite connected"
    try:
        with local_store._connect() as db:
            count = db.execute("SELECT COUNT(*) FROM investigations").fetchone()[0]
            db_detail = f"SQLite active ({count} investigations stored)"
    except Exception as exc:
        db_ok = False
        db_detail = f"Database error: {str(exc)}"

    # Gemini check
    gemini_configured = bool(settings.gemini_api_key)
    masked_gemini = (
        f"{settings.gemini_api_key[:6]}...{settings.gemini_api_key[-4:]}"
        if gemini_configured and len(settings.gemini_api_key or "") > 10
        else ("configured" if gemini_configured else "not_configured")
    )

    # Tavily check
    tavily_configured = bool(settings.tavily_api_key)
    masked_tavily = (
        f"{settings.tavily_api_key[:6]}...{settings.tavily_api_key[-4:]}"
        if tavily_configured and len(settings.tavily_api_key or "") > 10
        else ("configured" if tavily_configured else "not_configured")
    )

    return HealthResponse(
        status="ok" if db_ok else "degraded",
        service="evident-ai-api",
        version="0.1.0",
        environment=settings.app_env,
        local_dev_mode=settings.local_dev_mode,
        database={"connected": db_ok, "detail": db_detail, "type": "sqlite"},
        gemini={
            "configured": gemini_configured,
            "model": settings.gemini_model,
            "fallback_model": settings.gemini_fallback_model,
            "key_status": masked_gemini,
        },
        tavily={
            "configured": tavily_configured,
            "key_status": masked_tavily,
        },
        model=settings.gemini_model,
    )


@router.get("/system/stats")
async def get_system_stats(user: CurrentUser):
    if settings.local_dev_mode:
        return local_store.get_system_stats(str(user.id))
    return {
        "total_investigations": 0,
        "completed_investigations": 0,
        "failed_investigations": 0,
        "pending_investigations": 0,
        "type_counts": {},
        "total_claims": 0,
        "total_sources": 0,
        "total_evidence": 0,
        "avg_confidence": 0.0,
        "recent_investigations": [],
    }


@router.get("/evidence")
async def get_all_evidence(
    user: CurrentUser,
    limit: int = Query(default=100, ge=1, le=500),
    direction: str | None = Query(default=None),
):
    if settings.local_dev_mode:
        return local_store.get_all_evidence(str(user.id), limit=limit, direction=direction)
    return []


@router.post("/system/test-gemini")
async def test_gemini_connection():
    if not settings.gemini_api_key:
        return {"ok": False, "status": "GEMINI_NOT_CONFIGURED", "message": "No API key configured."}
    
    start = time.perf_counter()
    candidates = [
        settings.gemini_model.strip(),
        (settings.gemini_fallback_model or "").strip(),
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash",
    ]
    seen = set()
    models_to_try = [m for m in candidates if m and not (m in seen or seen.add(m))]

    last_status = "UNKNOWN"
    last_msg = ""
    for model in models_to_try:
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            payload = {
                "contents": [{"parts": [{"text": "Respond with single word: OK"}]}],
                "generationConfig": {"maxOutputTokens": 5}
            }
            async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=8.0)) as client:
                resp = await client.post(endpoint, headers={"x-goog-api-key": settings.gemini_api_key}, json=payload)
                elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
                if resp.status_code == 200:
                    return {
                        "ok": True,
                        "status": "OPERATIONAL",
                        "latency_ms": elapsed_ms,
                        "model": model,
                        "message": "Gemini API responded successfully."
                    }
                last_status = f"HTTP_{resp.status_code}"
                last_msg = resp.text[:200]
        except Exception as exc:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
            last_status = "CONNECTION_FAILED"
            last_msg = str(exc)

    return {
        "ok": False,
        "status": last_status,
        "latency_ms": round((time.perf_counter() - start) * 1000, 1),
        "message": last_msg
    }


@router.post("/system/test-tavily")
async def test_tavily_connection():
    if not settings.tavily_api_key:
        return {"ok": False, "status": "TAVILY_NOT_CONFIGURED", "message": "No Tavily API key configured."}

    start = time.perf_counter()
    try:
        endpoint = "https://api.tavily.com/search"
        payload = {
            "api_key": settings.tavily_api_key,
            "query": "ping",
            "max_results": 1
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=10.0)) as client:
            resp = await client.post(endpoint, json=payload)
            elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
            if resp.status_code == 200:
                return {
                    "ok": True,
                    "status": "OPERATIONAL",
                    "latency_ms": elapsed_ms,
                    "message": "Tavily Search API responded successfully."
                }
            return {
                "ok": False,
                "status": f"HTTP_{resp.status_code}",
                "latency_ms": elapsed_ms,
                "message": resp.text[:200]
            }
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        return {
            "ok": False,
            "status": "CONNECTION_FAILED",
            "latency_ms": elapsed_ms,
            "message": str(exc)
        }
