import asyncio
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
from uuid import UUID, uuid5

import httpx
from arq import Retry

from app.agents.investigation_graph import ProviderUnavailable, build_investigation_graph
from app.core.config import settings
from app.forensics.processors import (
    ToolUnavailable,
    analyze_av,
    analyze_image,
    extract_document,
    sha256_file,
)
from app.services.supabase import rest_request

logger = logging.getLogger(__name__)


def stable_id(investigation_id: str, kind: str) -> str:
    return str(uuid5(UUID(investigation_id), kind))


async def _update_investigation(investigation_id: str, fields: dict) -> None:
    await rest_request("PATCH", "investigations", admin=True, params={"id": f"eq.{investigation_id}", "status": "not.eq.CANCELLED"}, payload=fields, prefer="return=minimal")


async def _event(investigation_id: str, event_type: str, stage: str, message: str, details: dict | None = None) -> None:
    await rest_request("POST", "investigation_events", admin=True, payload={"investigation_id": investigation_id, "event_type": event_type, "stage": stage, "message": message, "details": details or {}}, prefer="return=minimal")


async def _upsert(table: str, row: dict) -> None:
    await rest_request("POST", table, admin=True, params={"on_conflict": "id"}, payload=row, prefer="resolution=merge-duplicates,return=minimal")


async def _record_agent(investigation_id: str, agent_name: str, status: str, started_at: datetime, tokens: int = 0, model_name: str | None = None) -> None:
    now = datetime.now(timezone.utc)
    is_finished = status not in {"QUEUED", "RUNNING"}
    await _upsert("agent_runs", {
        "id": stable_id(investigation_id, f"agent:{agent_name}"),
        "investigation_id": investigation_id,
        "agent_name": agent_name,
        "status": status,
        "model_name": model_name or ("Tavily Search" if agent_name == "research" else settings.gemini_model),
        "started_at": started_at.isoformat(),
        "finished_at": now.isoformat() if is_finished else None,
        "duration_ms": max(0, int((now - started_at).total_seconds() * 1000)) if is_finished else None,
        "token_count": tokens if tokens else None,
    })


class InvestigationCancelled(Exception):
    pass


async def run_investigation(ctx: dict, investigation_id: str, owner_id: str, submitted_type: str, content: str, language: str = "auto") -> None:
    attempt = int(ctx.get("_job_try", 1))
    agent_start: dict[str, datetime] = {}
    active_agent: str | None = None
    try:
        rows = await rest_request("GET", "investigations", admin=True, params={"id": f"eq.{investigation_id}", "select": "id,owner_id,status", "limit": "1"})
        if not rows or rows[0]["owner_id"] != owner_id or rows[0]["status"] == "CANCELLED":
            return

        await _update_investigation(investigation_id, {"status": "PROCESSING", "progress": 5, "current_stage": "Claim extraction"})
        await _event(investigation_id, "status", "claim_extraction", "Investigation processing started.")
        graph = build_investigation_graph()
        stage_info = {"claim_extraction": ("Claim extraction", 15), "research": ("Source research", 45), "evidence_evaluation": ("Evidence evaluation", 75)}

        async def progress(event: str, agent_name: str, output: dict | None) -> None:
            nonlocal active_agent
            label, percent = stage_info[agent_name]
            if event == "start":
                current = await rest_request("GET", "investigations", admin=True, params={"id": f"eq.{investigation_id}", "select": "status", "limit": "1"})
                if not current or current[0]["status"] == "CANCELLED":
                    raise InvestigationCancelled()
                started = datetime.now(timezone.utc)
                agent_start[agent_name] = started
                active_agent = agent_name
                await _record_agent(investigation_id, agent_name, "RUNNING", started)
                await _update_investigation(investigation_id, {"status": "ANALYZING", "progress": percent, "current_stage": label})
                await _event(investigation_id, "agent_started", agent_name, f"{label} started.")
            else:
                await _record_agent(investigation_id, agent_name, "COMPLETED", agent_start[agent_name], int((output or {}).get("token_count", 0)))
                await _event(investigation_id, "agent_completed", agent_name, f"{label} completed.")
                active_agent = None

        state = {"content": content, "submitted_type": submitted_type, "language": language, "token_count": 0, "progress_callback": progress}
        result = await graph.ainvoke(state)
        current = await rest_request("GET", "investigations", admin=True, params={"id": f"eq.{investigation_id}", "select": "status", "limit": "1"})
        if not current or current[0]["status"] == "CANCELLED":
            return
        tokens = int(result.get("token_count", 0))

        claims = result.get("claims", [])
        sources = result.get("sources", [])
        assessments = result.get("assessments", [])
        source_ids: dict[str, str] = {}
        for source in sources:
            source_id = stable_id(investigation_id, f"source:{source['url']}")
            source_ids[source["url"]] = source_id
            await _upsert("sources", {"id": source_id, "investigation_id": investigation_id, "url": source["url"], "title": source["title"], "publisher": source["publisher"], "published_at": source.get("published_at"), "retrieval_score": source.get("retrieval_score"), "reliability_basis": None, "reliability_assessment": None})

        for assessment in assessments:
            claim_id = stable_id(investigation_id, f"claim:{assessment['claim']}")
            limitations = assessment.get("limitations", [])
            await _upsert("claims", {"id": claim_id, "investigation_id": investigation_id, "text": assessment["claim"], "language": None, "factual_verdict": assessment["verdict"], "reasoning_summary": assessment["reasoning_summary"], "uncertainty": assessment.get("uncertainty") or f"Model confidence: {assessment['confidence']:.2f}. This is an evidence adequacy estimate, not certainty.", "limitations": " ".join(limitations)[:4000]})
            for direction, key in (("supporting", "supporting_source_urls"), ("contradicting", "contradicting_source_urls")):
                for source_url in assessment.get(key, []):
                    source = next((item for item in sources if item["url"] == source_url), None)
                    if not source or source_url not in source_ids:
                        continue
                    evidence_id = stable_id(investigation_id, f"evidence:{claim_id}:{source_url}:{direction}")
                    # Tavily's passage is provider-extracted context, not a verbatim quotation.
                    await _upsert("evidence", {"id": evidence_id, "investigation_id": investigation_id, "claim_id": claim_id, "source_id": source_ids[source_url], "quotation": None, "extracted_passage": source.get("passage", "")[:6000], "direction": direction, "relevance": source.get("retrieval_score"), "verification_status": "needs_review", "citation_status": "unchecked"})

        if result.get("extraction_error"):
            await _event(investigation_id, "partially_completed", "claim_extraction", result["extraction_error"])
            await _update_investigation(investigation_id, {"status": "PARTIALLY_COMPLETED", "progress": 100, "current_stage": "Page extraction incomplete", "completed_at": datetime.now(timezone.utc).isoformat()})
        else:
            await _event(investigation_id, "completed", "evidence_review", "Evidence-linked evaluation is ready for review.", {"claim_count": len(claims), "source_count": len(sources), "assessment_count": len(assessments)})
            await _update_investigation(investigation_id, {"status": "NEEDS_REVIEW" if claims else "COMPLETED", "progress": 100, "current_stage": "Human review" if claims else "Completed", "completed_at": datetime.now(timezone.utc).isoformat()})
        if tokens:
            await rest_request("POST", "usage_records", admin=True, payload={"user_id": owner_id, "investigation_id": investigation_id, "metric": "gemini_total_tokens", "quantity": tokens, "unit": "tokens"}, prefer="return=minimal")
    except InvestigationCancelled:
        return
    except ProviderUnavailable as exc:
        logger.warning("Investigation provider failure: code=%s attempt=%s", str(exc), attempt)
        if exc.retryable and attempt < 3:
            raise Retry(defer=5 * attempt) from exc
        if active_agent and active_agent in agent_start:
            await _record_agent(investigation_id, active_agent, "FAILED", agent_start[active_agent])
        await _event(investigation_id, "failed", "provider", "A required provider failed after retries; no verdict was produced.", {"code": str(exc)})
        await _update_investigation(investigation_id, {"status": "FAILED", "current_stage": "Provider error", "error_code": str(exc)})
    except Exception:
        logger.exception("Investigation worker failed: investigation_id=%s", investigation_id)
        if active_agent and active_agent in agent_start:
            await _record_agent(investigation_id, active_agent, "FAILED", agent_start[active_agent])
        await _event(investigation_id, "failed", "worker", "Investigation processing failed; no unsupported verdict was produced.", {"code": "WORKER_FAILURE"})
        await _update_investigation(investigation_id, {"status": "FAILED", "current_stage": "Processing error", "error_code": "WORKER_FAILURE"})
        return


async def _download_private_file(storage_path: str, destination: Path, expected_size: int) -> int:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("Private storage is not configured.")
    encoded_path = quote(storage_path, safe="/")
    endpoint = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/authenticated/investigation-files/{encoded_path}"
    headers = {"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}"}
    total = 0
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        async with client.stream("GET", endpoint, headers=headers) as response:
            if response.is_error:
                raise RuntimeError("The uploaded private file could not be retrieved.")
            with destination.open("wb") as output:
                async for chunk in response.aiter_bytes(1024 * 1024):
                    total += len(chunk)
                    if total > settings.max_upload_bytes or total > expected_size:
                        raise RuntimeError("Downloaded media exceeds its recorded size limit.")
                    output.write(chunk)
    if total != expected_size:
        raise RuntimeError("Uploaded file size did not match its registered metadata.")
    return total


async def run_media_investigation(ctx: dict, investigation_id: str, owner_id: str, file_id: str) -> None:
    rows = await rest_request("GET", "uploaded_files", admin=True, params={"id": f"eq.{file_id}", "investigation_id": f"eq.{investigation_id}", "owner_id": f"eq.{owner_id}", "select": "*", "limit": "1"})
    investigations = await rest_request("GET", "investigations", admin=True, params={"id": f"eq.{investigation_id}", "select": "id,owner_id,submitted_type,status,language", "limit": "1"})
    if not rows or not investigations or investigations[0]["owner_id"] != owner_id or investigations[0]["status"] == "CANCELLED":
        return
    file_record, investigation = rows[0], investigations[0]
    media_type = investigation["submitted_type"]
    started = datetime.now(timezone.utc)
    await _update_investigation(investigation_id, {"status": "PROCESSING", "progress": 5, "current_stage": "Secure file processing"})
    await _event(investigation_id, "status", "media_download", "Private file processing started.")
    await _record_agent(investigation_id, "media_forensics", "RUNNING", started, model_name="Pillow/FFmpeg/PDF text tools")
    try:
        suffix_by_mime = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/tiff": ".tiff", "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "video/x-matroska": ".mkv", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mp4": ".m4a", "audio/ogg": ".ogg", "audio/flac": ".flac", "application/pdf": ".pdf", "text/plain": ".txt", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"}
        with tempfile.TemporaryDirectory(prefix="evident-media-") as directory:
            path = Path(directory) / f"upload{suffix_by_mime[file_record['mime_type']]}"
            await _download_private_file(file_record["storage_path"], path, int(file_record["size_bytes"]))
            digest = await asyncio.to_thread(sha256_file, path)
            findings: list[dict] = []
            extracted_text = None
            perceptual_hash = None
            if media_type == "image":
                output = await asyncio.to_thread(analyze_image, path)
                findings = output["findings"]
                perceptual_hash = output["perceptual_hash"]
                prior = await rest_request("GET", "uploaded_files", admin=True, params={"owner_id": f"eq.{owner_id}", "id": f"neq.{file_id}", "select": "sha256,perceptual_hash", "limit": "1000"})
                for prior_file in prior:
                    if prior_file.get("sha256") == digest:
                        findings.append({"indicator": "exact_duplicate", "finding": "An exact SHA-256 match exists among this user's prior uploads.", "tool_name": "SHA-256", "tool_version": "1", "limitations": "A duplicate match does not establish the origin or authenticity of the image."})
                        break
                    prior_hash = prior_file.get("perceptual_hash")
                    if prior_hash and len(prior_hash) == len(perceptual_hash) and (int(prior_hash, 16) ^ int(perceptual_hash, 16)).bit_count() <= 5:
                        findings.append({"indicator": "near_duplicate", "finding": "A visually similar perceptual-hash match exists among this user's prior uploads.", "tool_name": "Difference hash", "tool_version": "v1", "limitations": "Perceptual hashes can collide and similarity does not establish shared origin."})
                        break
            elif media_type in {"video", "audio"}:
                output = await analyze_av(path, media_type)
                findings = output["findings"]
                for frame in output.get("frames", []):
                    findings.append({"indicator": "sampled_video_frame", "finding": f"Sampled frame perceptual hash {frame['perceptual_hash']}.", "tool_name": "FFmpeg + perceptual hash", "tool_version": "frame-sample-v1", "timestamp_ms": frame["timestamp_ms"], "limitations": "A frame sample is not a complete analysis of the video."})
            else:
                output = await asyncio.to_thread(extract_document, path, file_record["mime_type"], settings.max_text_chars)
                extracted_text = output["text"]
                findings = [{"indicator": "document_metadata", "finding": f"Document parsed; {output.get('pages') if output.get('pages') is not None else 'page count unavailable'} pages; {len(extracted_text)} text characters extracted; {output['metadata_fields']} metadata fields detected.", "tool_name": "pypdf" if file_record["mime_type"] == "application/pdf" else "python-docx/text", "tool_version": "installed", "limitations": "Embedded OCR, layout reconstruction, and citation verification are not included in this extraction step."}]
                if not extracted_text.strip() and file_record["mime_type"] == "application/pdf":
                    findings.append({"indicator": "ocr_unavailable", "finding": "No selectable text was extracted. The PDF may be scanned; OCR is not configured.", "tool_name": "pypdf", "tool_version": "installed", "limitations": "This does not establish that the document is empty."})

            await rest_request("PATCH", "uploaded_files", admin=True, params={"id": f"eq.{file_id}"}, payload={"sha256": digest, "perceptual_hash": perceptual_hash, "extracted_text": extracted_text}, prefer="return=minimal")
            await _update_investigation(investigation_id, {"status": "ANALYZING", "progress": 60, "current_stage": "Recording forensic indicators"})
            for finding in findings:
                indicator = finding["indicator"]
                record_id = stable_id(investigation_id, f"forensic:{file_id}:{indicator}:{finding.get('timestamp_ms','')}")
                await _upsert("forensic_results", {"id": record_id, "investigation_id": investigation_id, "uploaded_file_id": file_id, "media_type": media_type, "tool_name": finding["tool_name"], "tool_version": finding.get("tool_version"), "indicator": indicator, "finding": finding["finding"], "confidence": None, "timestamp_ms": finding.get("timestamp_ms"), "limitations": finding.get("limitations")})

        duration = max(0, int((datetime.now(timezone.utc) - started).total_seconds() * 1000))
        await _record_agent(investigation_id, "media_forensics", "COMPLETED", started, model_name="Pillow/FFmpeg/PDF text tools")
        await _event(investigation_id, "media_analysis_completed", "forensics", "Available metadata and forensic indicators were recorded.", {"media_type": media_type, "finding_count": len(findings)})
        if media_type == "document" and extracted_text and settings.gemini_api_key and settings.tavily_api_key:
            await run_investigation(ctx, investigation_id, owner_id, "text", extracted_text, investigation.get("language", "auto"))
        elif media_type == "document" and not extracted_text:
            await _update_investigation(investigation_id, {"status": "PARTIALLY_COMPLETED", "progress": 100, "current_stage": "OCR or readable text unavailable", "completed_at": datetime.now(timezone.utc).isoformat()})
        elif media_type == "document" and not (settings.gemini_api_key and settings.tavily_api_key):
            await _update_investigation(investigation_id, {"status": "PARTIALLY_COMPLETED", "progress": 100, "current_stage": "Text extracted; claim research not configured", "completed_at": datetime.now(timezone.utc).isoformat()})
        else:
            await _update_investigation(investigation_id, {"status": "NEEDS_REVIEW", "progress": 100, "current_stage": "Review forensic indicators", "completed_at": datetime.now(timezone.utc).isoformat()})
    except ToolUnavailable as exc:
        await _record_agent(investigation_id, "media_forensics", "FAILED", started, model_name="Pillow/FFmpeg/PDF text tools")
        await _event(investigation_id, "partially_completed", "forensics", str(exc))
        await _update_investigation(investigation_id, {"status": "PARTIALLY_COMPLETED", "progress": 100, "current_stage": "Required media tool unavailable", "error_code": "MEDIA_TOOL_UNAVAILABLE", "completed_at": datetime.now(timezone.utc).isoformat()})
    except Exception:
        logger.exception("Media worker failed: investigation_id=%s", investigation_id)
        await _record_agent(investigation_id, "media_forensics", "FAILED", started, model_name="Pillow/FFmpeg/PDF text tools")
        await _event(investigation_id, "failed", "forensics", "Media processing failed; no authenticity conclusion was produced.", {"code": "MEDIA_PROCESSING_FAILED"})
        await _update_investigation(investigation_id, {"status": "FAILED", "current_stage": "Media processing error", "error_code": "MEDIA_PROCESSING_FAILED"})
