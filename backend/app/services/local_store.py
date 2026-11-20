"""Single-user SQLite store for an explicitly enabled local MVP workspace."""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.core.config import settings


@contextmanager
def _connect():
    path = Path(settings.local_database_path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=20000")
    db.executescript("""
      CREATE TABLE IF NOT EXISTS investigations(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, submitted_type TEXT NOT NULL, submitted_content TEXT, language TEXT NOT NULL DEFAULT 'auto', status TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0, current_stage TEXT, error_code TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT);
      CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE, text TEXT NOT NULL, factual_verdict TEXT NOT NULL, reasoning_summary TEXT, confidence REAL NOT NULL DEFAULT 0, uncertainty TEXT, limitations TEXT, next_steps TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE, url TEXT NOT NULL, title TEXT, publisher TEXT, published_at TEXT, passage TEXT, retrieval_score REAL, retrieved_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE, claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE, source_id TEXT REFERENCES sources(id) ON DELETE CASCADE, direction TEXT NOT NULL, extracted_passage TEXT, citation_status TEXT NOT NULL DEFAULT 'unchecked', verification_status TEXT NOT NULL DEFAULT 'unverified', created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS investigation_events(id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE, event_type TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_runs(id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE, agent_name TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT, completed_at TEXT, duration_ms INTEGER, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS uploaded_files(id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE, owner_id TEXT NOT NULL, storage_path TEXT NOT NULL, original_filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT, perceptual_hash TEXT, extracted_text TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS forensic_results(id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE, indicator TEXT NOT NULL, finding TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, investigation_id TEXT NOT NULL REFERENCES investigations(id) ON DELETE CASCADE, version INTEGER NOT NULL, format TEXT NOT NULL DEFAULT 'json', status TEXT NOT NULL DEFAULT 'ready', report_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(investigation_id, version, format));
    """)
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row else None


def create_investigation(owner_id: str, title: str, kind: str, content: str | None, language: str) -> dict[str, Any]:
    now, identifier = _now(), str(uuid.uuid4())
    with _connect() as db:
        db.execute("INSERT INTO investigations(id,owner_id,title,submitted_type,submitted_content,language,status,current_stage,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (identifier, owner_id, title, kind, content, language, "QUEUED", "Preparing investigation", now, now))
        db.execute("INSERT INTO investigation_events VALUES(?,?,?,?,?)", (str(uuid.uuid4()), identifier, "created", "Investigation saved to local SQLite workspace.", now))
        row = db.execute("SELECT * FROM investigations WHERE id=? AND owner_id=?", (identifier, owner_id)).fetchone()
        return _dict(row) or {}


def get_investigation(identifier: str, owner_id: str) -> dict[str, Any]:
    with _connect() as db:
        row = db.execute("SELECT * FROM investigations WHERE id=? AND owner_id=?", (identifier, owner_id)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail={"code": "INVESTIGATION_NOT_FOUND", "message": "Investigation was not found."})
    return _dict(row) or {}


def list_investigations(owner_id: str) -> list[dict[str, Any]]:
    with _connect() as db:
        return [dict(row) for row in db.execute("SELECT id,title,submitted_type,status,progress,current_stage,created_at,updated_at,completed_at FROM investigations WHERE owner_id=? ORDER BY created_at DESC LIMIT 100", (owner_id,))]


def update_status(identifier: str, owner_id: str, status: str, *, progress: int | None = None, stage: str | None = None, error_code: str | None = None, error_message: str | None = None) -> None:
    now = _now()
    with _connect() as db:
        db.execute("UPDATE investigations SET status=?,progress=COALESCE(?,progress),current_stage=?,error_code=?,error_message=?,updated_at=?,completed_at=CASE WHEN ? IN ('COMPLETED','PARTIALLY_COMPLETED','NEEDS_REVIEW','FAILED','CANCELLED') THEN ? ELSE completed_at END WHERE id=? AND owner_id=?", (status, progress, stage, error_code, error_message, now, status, now, identifier, owner_id))


def add_event(identifier: str, event_type: str, message: str) -> None:
    with _connect() as db:
        db.execute("INSERT INTO investigation_events VALUES(?,?,?,?,?)", (str(uuid.uuid4()), identifier, event_type, message[:1000], _now()))


def start_agent_run(identifier: str, agent_name: str) -> tuple[str, datetime]:
    run_id, started = str(uuid.uuid4()), datetime.now(timezone.utc)
    with _connect() as db:
        db.execute(
            "INSERT INTO agent_runs(id,investigation_id,agent_name,status,started_at,created_at) VALUES(?,?,?,?,?,?)",
            (run_id, identifier, agent_name, "RUNNING", started.isoformat(), started.isoformat()),
        )
    return run_id, started


def finish_agent_run(run_id: str, started: datetime, status: str = "COMPLETED") -> None:
    finished = datetime.now(timezone.utc)
    duration_ms = max(0, int((finished - started).total_seconds() * 1000))
    with _connect() as db:
        db.execute(
            "UPDATE agent_runs SET status=?,completed_at=?,duration_ms=? WHERE id=?",
            (status, finished.isoformat(), duration_ms, run_id),
        )


def save_workflow(identifier: str, owner_id: str, state: dict[str, Any]) -> None:
    now = _now()
    with _connect() as db:
        for source in state.get("sources", []):
            sid = str(uuid.uuid4())
            db.execute("INSERT OR IGNORE INTO sources(id,investigation_id,url,title,publisher,published_at,passage,retrieval_score,retrieved_at) VALUES(?,?,?,?,?,?,?,?,?)", (sid, identifier, source["url"], source.get("title"), source.get("publisher"), source.get("published_at"), source.get("passage"), source.get("retrieval_score"), now))
        source_rows = {row["url"]: row["id"] for row in db.execute("SELECT id,url FROM sources WHERE investigation_id=?", (identifier,))}
        for item in state.get("assessments", []):
            claim_id = str(uuid.uuid4())
            verdict = item.get("verdict", "UNVERIFIED")
            db.execute("INSERT INTO claims(id,investigation_id,text,factual_verdict,reasoning_summary,confidence,uncertainty,limitations,next_steps,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (claim_id, identifier, item["claim"], verdict, item.get("reasoning_summary"), float(item.get("confidence", 0)), item.get("uncertainty"), json.dumps(item.get("limitations", [])), json.dumps(item.get("next_steps", [])), now))
            for direction, key in (("supporting", "supporting_source_urls"), ("contradicting", "contradicting_source_urls")):
                for url in item.get(key, []):
                    source_id = source_rows.get(url)
                    if not source_id:
                        continue
                    passage = db.execute("SELECT passage FROM sources WHERE id=?", (source_id,)).fetchone()
                    db.execute("INSERT INTO evidence(id,investigation_id,claim_id,source_id,direction,extracted_passage,citation_status,verification_status,created_at) VALUES(?,?,?,?,?,?,?,?,?)", (str(uuid.uuid4()), identifier, claim_id, source_id, direction, passage[0] if passage else None, "retrieved", "unverified", now))
        final_status = "NEEDS_REVIEW" if state.get("claims") else "COMPLETED"
        stage = "Analysis complete; human review recommended" if state.get("claims") else "No checkable claims found"
        db.execute("UPDATE investigations SET status=?,progress=100,current_stage=?,updated_at=?,completed_at=? WHERE id=? AND owner_id=?", (final_status, stage, now, now, identifier, owner_id))
        db.execute("INSERT INTO investigation_events VALUES(?,?,?,?,?)", (str(uuid.uuid4()), identifier, "completed", "Provider workflow completed; persisted outputs are available for review.", now))


async def run_local_analysis(identifier: str, owner_id: str, kind: str, content: str, language: str) -> None:
    from app.agents.investigation_graph import ProviderUnavailable, build_investigation_graph
    if get_investigation(identifier, owner_id)["status"] == "CANCELLED":
        return
    update_status(identifier, owner_id, "PROCESSING", progress=5, stage="Preparing claim extraction")
    add_event(identifier, "processing", "Local SQLite investigation processing started.")
    stage_info = {
        "claim_extraction": ("Claim extraction", 15),
        "research": ("Source research", 45),
        "evidence_evaluation": ("Evidence evaluation", 75),
    }
    active_runs: dict[str, tuple[str, datetime]] = {}

    async def progress(event: str, agent_name: str, _output: dict[str, Any] | None) -> None:
        label, percent = stage_info[agent_name]
        if event == "start":
            update_status(identifier, owner_id, "ANALYZING", progress=percent, stage=label)
            active_runs[agent_name] = start_agent_run(identifier, agent_name)
            add_event(identifier, "agent_started", f"{label} started.")
            return
        run_id, started = active_runs.pop(agent_name)
        finish_agent_run(run_id, started)
        add_event(identifier, "agent_completed", f"{label} completed.")

    try:
        graph = build_investigation_graph()
        state = await graph.ainvoke({"content": content, "submitted_type": kind, "language": language, "progress_callback": progress})
        if get_investigation(identifier, owner_id)["status"] == "CANCELLED":
            return
        save_workflow(identifier, owner_id, state)
    except ProviderUnavailable as exc:
        if get_investigation(identifier, owner_id)["status"] == "CANCELLED":
            return
        for run_id, started in active_runs.values():
            finish_agent_run(run_id, started, "FAILED")
        missing = str(exc)
        if missing == "GEMINI_NOT_CONFIGURED":
            message = "Gemini API is not configured. Add GEMINI_API_KEY and retry."
        elif missing.startswith("GEMINI_HTTP_401"):
            message = "Gemini rejected the API key. Check that GEMINI_API_KEY is valid and enabled for the Gemini API."
        elif missing.startswith("GEMINI_HTTP_403"):
            message = "Gemini denied this request. Check the API key restrictions, project access, and account status; backend logs include Google's error code and message."
        elif missing.startswith("GEMINI_HTTP_404"):
            message = "The configured Gemini model or endpoint was not found. Check GEMINI_MODEL and backend logs."
        elif missing.startswith("GEMINI_HTTP_429"):
            message = "Gemini rate or quota limits were reached. Check the project quota and retry later."
        elif missing.startswith("GEMINI_HTTP_400"):
            message = "Gemini rejected the structured request. Check the schema or request details in backend logs."
        elif missing.startswith("GEMINI_HTTP_5"):
            message = "Gemini is temporarily unavailable. Check backend logs and retry later."
        elif missing in {"GEMINI_TIMEOUT", "GEMINI_CONNECTION_FAILED"}:
            message = "The backend could not reach Gemini. Check network access and backend logs, then retry."
        elif missing in {"GEMINI_NO_CANDIDATES", "GEMINI_EMPTY_RESPONSE", "GEMINI_INVALID_JSON", "GEMINI_INVALID_RESPONSE"}:
            message = "Gemini did not return a usable structured response. Backend logs include safe response diagnostics; no verdict was produced."
        elif missing.startswith("GEMINI_"):
            message = "Gemini could not complete the structured analysis. Check the key, model setting, provider status, and backend logs."
        elif missing == "RESEARCH_NOT_CONFIGURED":
            message = "Research is not configured. Add TAVILY_API_KEY and retry."
        elif missing.startswith(("RESEARCH_HTTP_401", "RESEARCH_HTTP_403")):
            message = "Tavily rejected its API key or project access. Check TAVILY_API_KEY and the provider account settings."
        elif missing.startswith("RESEARCH_HTTP_429"):
            message = "Tavily rate or quota limits were reached. Check the provider quota and retry later."
        elif missing.startswith("RESEARCH_HTTP_400"):
            message = "Tavily rejected the research request. Backend logs include its safe error details."
        elif missing.startswith("RESEARCH_HTTP_5"):
            message = "Tavily is temporarily unavailable. Check backend logs and retry later."
        elif missing in {"RESEARCH_TIMEOUT", "RESEARCH_CONNECTION_FAILED"}:
            message = "The backend could not reach Tavily. Check network access and backend logs, then retry."
        elif missing == "RESEARCH_INVALID_RESPONSE":
            message = "Tavily returned an unreadable search response. Check backend logs; no verdict was produced."
        elif missing == "RESEARCH_REQUEST_FAILED":
            message = "Tavily research failed. Check the key, provider status, and backend logs. No verdict was produced."
        elif missing.startswith("URL_EXTRACTION_HTTP_401") or missing.startswith("URL_EXTRACTION_HTTP_403"):
            message = "Tavily rejected its API key or project access while extracting the page. Check TAVILY_API_KEY and account settings."
        elif missing.startswith("URL_EXTRACTION_HTTP_429"):
            message = "Tavily rate or quota limits were reached during page extraction. Check provider quota and retry later."
        elif missing.startswith("URL_EXTRACTION_HTTP_5"):
            message = "Tavily is temporarily unavailable for page extraction. Check backend logs and retry later."
        elif missing in {"URL_EXTRACTION_TIMEOUT", "URL_EXTRACTION_CONNECTION_FAILED"}:
            message = "The backend could not reach Tavily to extract the page. Check network access and retry later."
        elif missing == "URL_EXTRACTION_INVALID_RESPONSE":
            message = "Tavily returned an unreadable page-extraction response. Check backend logs; no verdict was produced."
        elif missing.startswith("URL_"):
            message = "The submitted URL could not be safely extracted. Check that it is a public HTTP or HTTPS page. No verdict was produced."
        else:
            message = "A required investigation provider is unavailable. Check backend configuration and logs. No verdict was produced."
        update_status(identifier, owner_id, "FAILED", progress=100, stage="Provider unavailable", error_code=missing, error_message=message)
        add_event(identifier, "provider_unavailable", message)
    except Exception:
        if get_investigation(identifier, owner_id)["status"] == "CANCELLED":
            return
        for run_id, started in active_runs.values():
            finish_agent_run(run_id, started, "FAILED")
        update_status(identifier, owner_id, "FAILED", progress=100, stage="Analysis failed", error_code="ANALYSIS_FAILED", error_message="The investigation could not be completed. Check provider configuration and backend logs.")
        add_event(identifier, "failed", "Investigation failed; no verdict was recorded.")


def list_results(identifier: str, owner_id: str) -> dict[str, list[dict[str, Any]]]:
    get_investigation(identifier, owner_id)
    with _connect() as db:
        tables = {"claims": "claims", "sources": "sources", "evidence": "evidence", "agent_runs": "agent_runs", "events": "investigation_events", "forensic_results": "forensic_results", "uploaded_files": "uploaded_files"}
        result = {}
        for key, table in tables.items():
            order_column = "retrieved_at" if table == "sources" else "created_at"
            rows = db.execute(f"SELECT * FROM {table} WHERE investigation_id=? ORDER BY {order_column}", (identifier,)).fetchall()
            result[key] = [dict(row) for row in rows]
        for item in result["uploaded_files"]:
            item.pop("storage_path", None)
        for claim in result["claims"]:
            for field in ("limitations", "next_steps"):
                try: claim[field] = json.loads(claim.get(field) or "[]")
                except (ValueError, TypeError): claim[field] = []
    return result


def delete_investigation(identifier: str, owner_id: str) -> None:
    get_investigation(identifier, owner_id)
    with _connect() as db:
        db.execute("DELETE FROM investigations WHERE id=? AND owner_id=?", (identifier, owner_id))


def get_system_stats(owner_id: str) -> dict[str, Any]:
    with _connect() as db:
        total = db.execute("SELECT COUNT(*) FROM investigations WHERE owner_id=?", (owner_id,)).fetchone()[0]
        completed = db.execute("SELECT COUNT(*) FROM investigations WHERE owner_id=? AND status IN ('COMPLETED', 'NEEDS_REVIEW', 'PARTIALLY_COMPLETED')", (owner_id,)).fetchone()[0]
        failed = db.execute("SELECT COUNT(*) FROM investigations WHERE owner_id=? AND status='FAILED'", (owner_id,)).fetchone()[0]
        pending = db.execute("SELECT COUNT(*) FROM investigations WHERE owner_id=? AND status IN ('QUEUED', 'PROCESSING', 'ANALYZING', 'EVIDENCE_REVIEW')", (owner_id,)).fetchone()[0]
        
        type_counts = {}
        for row in db.execute("SELECT submitted_type, COUNT(*) as c FROM investigations WHERE owner_id=? GROUP BY submitted_type", (owner_id,)).fetchall():
            type_counts[row["submitted_type"]] = row["c"]
            
        total_claims = db.execute("SELECT COUNT(*) FROM claims c JOIN investigations i ON i.id=c.investigation_id WHERE i.owner_id=?", (owner_id,)).fetchone()[0]
        total_sources = db.execute("SELECT COUNT(*) FROM sources s JOIN investigations i ON i.id=s.investigation_id WHERE i.owner_id=?", (owner_id,)).fetchone()[0]
        total_evidence = db.execute("SELECT COUNT(*) FROM evidence e JOIN investigations i ON i.id=e.investigation_id WHERE i.owner_id=?", (owner_id,)).fetchone()[0]
        
        avg_conf_row = db.execute("SELECT AVG(confidence) FROM claims c JOIN investigations i ON i.id=c.investigation_id WHERE i.owner_id=? AND confidence > 0", (owner_id,)).fetchone()
        avg_confidence = round(float(avg_conf_row[0]), 2) if avg_conf_row and avg_conf_row[0] is not None else 0.0

        recent_rows = db.execute("""
            SELECT i.id, i.title, i.submitted_type, i.status, i.progress, i.current_stage, i.created_at, i.completed_at,
                   (SELECT factual_verdict FROM claims WHERE investigation_id = i.id ORDER BY confidence DESC LIMIT 1) as primary_verdict,
                   (SELECT confidence FROM claims WHERE investigation_id = i.id ORDER BY confidence DESC LIMIT 1) as confidence
            FROM investigations i
            WHERE i.owner_id=?
            ORDER BY i.created_at DESC LIMIT 10
        """, (owner_id,)).fetchall()
        recent = [dict(r) for r in recent_rows]

        return {
            "total_investigations": total,
            "completed_investigations": completed,
            "failed_investigations": failed,
            "pending_investigations": pending,
            "type_counts": type_counts,
            "total_claims": total_claims,
            "total_sources": total_sources,
            "total_evidence": total_evidence,
            "avg_confidence": avg_confidence,
            "recent_investigations": recent,
        }


def get_all_evidence(owner_id: str, limit: int = 100, direction: str | None = None) -> list[dict[str, Any]]:
    with _connect() as db:
        query = """
            SELECT e.id, e.direction, e.extracted_passage, e.citation_status, e.verification_status, e.created_at,
                   c.text as claim_text, c.factual_verdict, c.confidence as claim_confidence,
                   s.url as source_url, s.title as source_title, s.publisher as source_publisher, s.published_at as source_published_at,
                   i.id as investigation_id, i.title as investigation_title, i.submitted_type
            FROM evidence e
            JOIN investigations i ON i.id = e.investigation_id
            LEFT JOIN claims c ON c.id = e.claim_id
            LEFT JOIN sources s ON s.id = e.source_id
            WHERE i.owner_id = ?
        """
        params: list[Any] = [owner_id]
        if direction:
            query += " AND e.direction = ?"
            params.append(direction)
        query += " ORDER BY e.created_at DESC LIMIT ?"
        params.append(limit)
        return [dict(row) for row in db.execute(query, tuple(params)).fetchall()]


def save_local_image(owner_id: str, original_name: str, mime_type: str, size: int, file_path: Path, findings: list[dict[str, Any]], sha256: str, perceptual_hash: str) -> dict[str, Any]:
    title = Path(original_name).stem[:240] or "Image investigation"
    item = create_investigation(owner_id, title, "image", None, "auto")
    now, identifier, file_id = _now(), item["id"], str(uuid.uuid4())
    with _connect() as db:
        db.execute("INSERT INTO uploaded_files(id,investigation_id,owner_id,storage_path,original_filename,mime_type,size_bytes,sha256,perceptual_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", (file_id, identifier, owner_id, str(file_path.resolve()), Path(original_name).name[:255], mime_type, size, sha256, perceptual_hash, now))
        for finding in findings:
            db.execute("INSERT INTO forensic_results VALUES(?,?,?,?,?,?)", (str(uuid.uuid4()), identifier, finding["indicator"], finding["finding"], json.dumps({"tool": finding.get("tool_name"), "limitations": finding.get("limitations")}, ensure_ascii=False), now))
        db.execute("UPDATE investigations SET status='NEEDS_REVIEW',progress=100,current_stage='Image metadata analysis complete',updated_at=?,completed_at=? WHERE id=?", (now, now, identifier))
        db.execute("INSERT INTO investigation_events VALUES(?,?,?,?,?)", (str(uuid.uuid4()), identifier, "image_metadata", "Basic image metadata and forensic indicators recorded.", now))
    return get_investigation(identifier, owner_id)


def save_report(identifier: str, owner_id: str) -> dict[str, Any]:
    investigation = get_investigation(identifier, owner_id)
    results = list_results(identifier, owner_id)
    now, report_id = _now(), str(uuid.uuid4())
    with _connect() as db:
        version = int(db.execute("SELECT COALESCE(MAX(version),0)+1 FROM reports WHERE investigation_id=?", (identifier,)).fetchone()[0])
        document = {"report_id": report_id, "version": version, "generated_at": now, "investigation": investigation, "executive_summary": "This report reflects only the persisted outputs available at generation time.", **results, "limitations": ["Review all source links and passages independently.", "Forensic indicators are not proof of authenticity or manipulation.", "A human reviewer should assess conclusions before relying on them."]}
        db.execute("INSERT INTO reports VALUES(?,?,?,?,?,?,?)", (report_id, identifier, version, "json", "ready", json.dumps(document, ensure_ascii=False), now))
    return {"id": report_id, "investigation_id": identifier, "version": version, "format": "json", "status": "ready", "created_at": now}


def list_reports(owner_id: str) -> list[dict[str, Any]]:
    with _connect() as db:
        return [dict(row) for row in db.execute("SELECT r.id,r.investigation_id,r.version,r.format,r.status,r.created_at FROM reports r JOIN investigations i ON i.id=r.investigation_id WHERE i.owner_id=? ORDER BY r.created_at DESC LIMIT 100", (owner_id,))]


def get_report(report_id: str, owner_id: str) -> dict[str, Any]:
    with _connect() as db:
        row = db.execute("SELECT r.* FROM reports r JOIN investigations i ON i.id=r.investigation_id WHERE r.id=? AND i.owner_id=?", (report_id, owner_id)).fetchone()
    if not row: raise HTTPException(status_code=404, detail={"code": "REPORT_NOT_FOUND", "message": "Report was not found."})
    item = dict(row); item["report_json"] = json.loads(item["report_json"]); return item
