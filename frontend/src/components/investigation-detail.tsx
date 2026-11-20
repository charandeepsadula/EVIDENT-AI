"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Download,
  Printer,
  FileText,
  Activity,
  ArrowRight,
  ShieldCheck,
  Search
} from "@/components/icons";

interface Investigation {
  id: string;
  title: string;
  submitted_type: string;
  submitted_content: string | null;
  status: string;
  progress: number;
  current_stage: string | null;
  created_at: string;
  completed_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
}

interface Results {
  claims: Array<Record<string, any>>;
  sources: Array<Record<string, any>>;
  evidence: Array<Record<string, any>>;
  agent_runs: Array<Record<string, any>>;
  events: Array<Record<string, any>>;
  forensic_results: Array<Record<string, any>>;
  uploaded_files: Array<Record<string, any>>;
}

const terminal = new Set([
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "NEEDS_REVIEW",
  "FAILED",
  "CANCELLED",
]);

export function InvestigationDetail({ id }: { id: string }) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [evidenceFilter, setEvidenceFilter] = useState<"all" | "supporting" | "contradicting">("all");

  const refresh = useCallback(async () => {
    try {
      const item = await apiFetch<Investigation>(`/investigations/${id}`);
      setInvestigation(item);
      setError("");
      if (terminal.has(item.status)) {
        setResults(await apiFetch<Results>(`/investigations/${id}/results`));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load investigation record.");
    }
  }, [id]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!investigation || !terminal.has(investigation.status)) {
        void refresh();
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refresh, investigation]);

  async function cancel() {
    setBusy(true);
    try {
      await apiFetch(`/investigations/${id}/cancel`, { method: "POST" });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to cancel.");
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    if (!investigation || !results) return;
    const blob = new Blob(
      [JSON.stringify({ investigation, results, exported_at: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `evident-investigation-${id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const isTerminal = investigation ? terminal.has(investigation.status) : false;
  const isRunning = investigation ? !isTerminal : true;

  // Filter evidence
  const allEvidence = results?.evidence ?? [];
  const filteredEvidence = allEvidence.filter((item) => {
    if (evidenceFilter === "all") return true;
    return item.direction === evidenceFilter;
  });

  return (
    <WorkspaceShell active="Investigation Results">
      <div className="page-content">
        <div style={{ marginBottom: "16px" }}>
          <Link href="/investigations/history" style={{ fontSize: "11px", color: "var(--orange)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            &larr; Back to Investigation Vault
          </Link>
        </div>

        <PageHeading
          eyebrow="INTELLIGENCE REPORT & AUDIT"
          title={investigation?.title ?? "Investigation Details"}
          description={
            investigation
              ? `${investigation.submitted_type.toUpperCase()} VERIFICATION &bull; Started ${new Date(investigation.created_at).toLocaleString()}`
              : "Connecting to investigation record..."
          }
          action={
            investigation && isTerminal ? (
              <div style={{ display: "flex", gap: "10px" }}>
                <Link href={`/reports`} className="button button-primary button-sm">
                  <FileText size={13} /> Generate Dossier
                </Link>
                <button className="button button-secondary button-sm" onClick={exportJson} type="button">
                  <Download size={13} /> Export JSON
                </button>
                <button className="button button-secondary button-sm" onClick={() => window.print()} type="button">
                  <Printer size={13} /> Print
                </button>
              </div>
            ) : undefined
          }
        />

        {error && (
          <div className="notice" style={{ borderColor: "var(--red-line)", background: "var(--red-bg)" }}>
            <span className="notice-symbol" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#EF4444" }}>!</span>
            <p>{error}</p>
            <button className="button button-secondary button-sm" onClick={() => void refresh()} type="button">
              Retry
            </button>
          </div>
        )}

        {investigation?.error_message && (
          <div className="notice" style={{ borderColor: "var(--red-line)", background: "var(--red-bg)" }}>
            <span className="notice-symbol" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#EF4444" }}>!</span>
            <p>
              <b>Investigation Halt:</b> {investigation.error_message}
            </p>
          </div>
        )}

        {investigation && (
          <>
            {/* Live Pipeline Status Bar */}
            <section className="panel status-panel" style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <div className="eyebrow">PIPELINE EXECUTION STATE</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <strong style={{ fontSize: "16px", color: isTerminal ? "var(--green)" : "var(--orange)" }}>
                      {investigation.status.replaceAll("_", " ")}
                    </strong>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      &bull; {investigation.current_stage ?? "Evaluating research passages"}
                    </span>
                  </div>
                </div>

                <div className="progress-side" style={{ minWidth: "240px" }}>
                  <span>{investigation.progress}% COMPLETE</span>
                  <div className="progress-track">
                    <i style={{ width: `${investigation.progress}%` }} />
                  </div>
                </div>

                {isRunning && (
                  <button className="button button-danger button-sm" onClick={() => void cancel()} disabled={busy} type="button">
                    Stop Investigation
                  </button>
                )}
              </div>
            </section>

            {/* Split View: Submitted Input & Extracted Claims */}
            <div className="investigation-columns">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Submitted Content</h2>
                    <p>Raw input captured for verification audit</p>
                  </div>
                  <span className="status-badge">{investigation.submitted_type}</span>
                </div>

                {investigation.submitted_content ? (
                  <pre className="submitted-content">{investigation.submitted_content}</pre>
                ) : results?.uploaded_files.length ? (
                  results.uploaded_files.map((file, idx) => (
                    <div key={file.id ?? idx} style={{ padding: "12px", background: "var(--panel2)", borderRadius: "6px", border: "1px solid var(--line)" }}>
                      <b style={{ display: "block", fontSize: "12px" }}>{file.original_filename}</b>
                      <small style={{ color: "var(--muted)", fontSize: "10px" }}>
                        {file.mime_type} &bull; {(Number(file.size_bytes) / 1024 / 1024).toFixed(2)} MB
                        {file.sha256 ? ` &bull; SHA-256: ${String(file.sha256).slice(0, 16)}...` : ""}
                      </small>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: "11px" }}>No content record found.</div>
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Evaluated Claims & Verdicts</h2>
                    <p>Atomic sub-claims decomposed by Gemini with explainable verdicts</p>
                  </div>
                  <span className="status-badge orange">
                    {results?.claims.length ?? 0} CLAIMS EVALUATED
                  </span>
                </div>

                {results?.claims.length ? (
                  results.claims.map((claim, idx) => <ClaimCard key={claim.id ?? idx} claim={claim} />)
                ) : (
                  <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                    {investigation.status === "FAILED"
                      ? "Processing could not be completed. Check API configuration."
                      : isRunning
                      ? "Decomposing input into testable factual claims..."
                      : "No checkable factual claims were identified in the submitted text."}
                  </div>
                )}
              </section>
            </div>

            {/* Evidence & Citations Explorer */}
            <section className="panel detail-panel" style={{ marginTop: "20px" }}>
              <div className="panel-head">
                <div>
                  <h2>Evidence Matrix & Traceable Citations</h2>
                  <p>Peer sources retrieved via Tavily Search with exact quoted passages</p>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className={`button button-sm ${evidenceFilter === "all" ? "button-primary" : "button-secondary"}`}
                    onClick={() => setEvidenceFilter("all")}
                  >
                    All ({allEvidence.length})
                  </button>
                  <button
                    type="button"
                    className={`button button-sm ${evidenceFilter === "supporting" ? "button-primary" : "button-secondary"}`}
                    onClick={() => setEvidenceFilter("supporting")}
                  >
                    Supporting ({allEvidence.filter((e) => e.direction === "supporting").length})
                  </button>
                  <button
                    type="button"
                    className={`button button-sm ${evidenceFilter === "contradicting" ? "button-primary" : "button-secondary"}`}
                    onClick={() => setEvidenceFilter("contradicting")}
                  >
                    Contradicting ({allEvidence.filter((e) => e.direction === "contradicting").length})
                  </button>
                </div>
              </div>

              {filteredEvidence.length ? (
                filteredEvidence.map((item, idx) => (
                  <EvidenceCard key={item.id ?? idx} item={item} sources={results?.sources ?? []} />
                ))
              ) : (
                <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                  {isRunning
                    ? "Searching global sources and collecting corroborating passages..."
                    : "No specific evidence items matched the current filter."}
                </div>
              )}
            </section>

            {/* Forensic Indicators (If Image/Media) */}
            {results?.forensic_results && results.forensic_results.length > 0 && (
              <section className="panel detail-panel" style={{ marginTop: "20px" }}>
                <div className="panel-head">
                  <div>
                    <h2>Digital Media Forensics & Visual Observations</h2>
                    <p>EXIF metadata, C2PA content provenance markers, and Gemini Vision analysis</p>
                  </div>
                  <span className="status-badge green">FORENSIC AUDIT</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {results.forensic_results.map((forensic, idx) => (
                    <div
                      key={forensic.id ?? idx}
                      style={{
                        padding: "12px 14px",
                        background: "var(--panel2)",
                        borderRadius: "7px",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <b style={{ fontSize: "12px", color: "var(--text)" }}>{forensic.indicator?.toUpperCase().replaceAll("_", " ")}</b>
                        <span style={{ fontSize: "10px", color: "var(--orange)" }}>
                          {forensic.details ? JSON.parse(forensic.details)?.tool ?? "Pillow/Gemini" : "Forensics"}
                        </span>
                      </div>
                      <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.5" }}>
                        {forensic.finding}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Technical Audit Trail */}
            <div className="investigation-columns" style={{ marginTop: "20px" }}>
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Multi-Agent Workflow Runs</h2>
                    <p>Execution latency and agent orchestration telemetry</p>
                  </div>
                </div>
                {results?.agent_runs.length ? (
                  results.agent_runs.map((run, idx) => (
                    <div className="activity-row" key={run.id ?? idx}>
                      <span className="activity-dot" />
                      <span>{String(run.agent_name ?? "Agent").replaceAll("_", " ")}</span>
                      <b style={{ color: "var(--green)" }}>{String(run.status ?? "COMPLETED")}</b>
                      <small>{run.duration_ms ? `${run.duration_ms} ms` : ""}</small>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: "11px", padding: "12px 0" }}>
                    Agent telemetry is recorded as each stage concludes.
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Investigation Event Log</h2>
                    <p>Audit trail of state transitions and human checkpoints</p>
                  </div>
                </div>
                {results?.events.length ? (
                  results.events.map((event, idx) => (
                    <div className="activity-row" key={event.id ?? idx}>
                      <span className="activity-dot" />
                      <span>{String(event.message ?? event.event_type ?? "")}</span>
                      <small>{event.created_at ? new Date(String(event.created_at)).toLocaleTimeString() : ""}</small>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: "11px", padding: "12px 0" }}>
                    No events recorded yet.
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function ClaimCard({ claim }: { claim: Record<string, any> }) {
  const verdict = (claim.factual_verdict as string || "unverified").toLowerCase();
  const limitations = Array.isArray(claim.limitations)
    ? claim.limitations.map(String).join(" ")
    : String(claim.limitations ?? "");
  const nextSteps = Array.isArray(claim.next_steps)
    ? claim.next_steps.map(String).join(" ")
    : String(claim.next_steps ?? "");
  const confPercent = Math.round(Number(claim.confidence ?? 0) * 100);

  return (
    <article className="claim-result" style={{ padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
      <div className="claim-verdict-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span className={`verdict-chip ${verdict}`}>
          {String(claim.factual_verdict ?? "UNVERIFIED").replaceAll("_", " ")}
        </span>
        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
          Evidence Adequacy: <b>{confPercent}%</b>
        </span>
      </div>

      <p className="claim-text" style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 8px", color: "#FFFFFF" }}>
        &ldquo;{String(claim.text ?? "")}&rdquo;
      </p>

      <p className="claim-reasoning" style={{ fontSize: "12px", color: "var(--text-dim)", lineHeight: "1.6", margin: "0 0 8px" }}>
        {String(claim.reasoning_summary ?? "No reasoning summary returned.")}
      </p>

      {claim.uncertainty && (
        <div style={{ fontSize: "11px", color: "var(--amber)", margin: "4px 0", background: "var(--amber-bg)", padding: "6px 10px", borderRadius: "5px", border: "1px solid var(--amber-line)" }}>
          <b>Uncertainty:</b> {claim.uncertainty}
        </div>
      )}

      {limitations && (
        <p className="claim-limit" style={{ fontSize: "10.5px", color: "var(--muted)", margin: "4px 0" }}>
          <b>Evidence Limitations:</b> {limitations}
        </p>
      )}

      {nextSteps && (
        <p className="claim-limit" style={{ fontSize: "10.5px", color: "var(--muted)", margin: "4px 0" }}>
          <b>Suggested Next Steps:</b> {nextSteps}
        </p>
      )}
    </article>
  );
}

function EvidenceCard({ item, sources }: { item: Record<string, any>; sources: Array<Record<string, any>> }) {
  const source = sources.find((entry) => entry.id === item.source_id);
  const direction = String(item.direction ?? "context").toLowerCase();

  return (
    <article className="evidence-card">
      <div className="evidence-card-top" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <span className={`direction-chip ${direction}`}>
          {direction}
        </span>
        <span className="status-badge" style={{ fontSize: "8.5px" }}>
          CITATION {String(item.citation_status ?? "verified")}
        </span>
        {source?.publisher && (
          <span style={{ fontSize: "10.5px", color: "var(--muted)", marginLeft: "auto" }}>
            Publisher: <b>{source.publisher}</b>
          </span>
        )}
      </div>

      {item.extracted_passage && (
        <div className="evidence-passage">
          &ldquo;{item.extracted_passage}&rdquo;
        </div>
      )}

      {source && (
        <div style={{ marginTop: "6px" }}>
          <a href={String(source.url)} target="_blank" rel="noreferrer" className="source-link">
            <ExternalLink size={12} /> {String(source.title || source.publisher || source.url)}
          </a>
        </div>
      )}
    </article>
  );
}
