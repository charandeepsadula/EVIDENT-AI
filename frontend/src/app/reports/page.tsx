"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import { ApiError, apiFetch } from "@/lib/api";
import { FileText, Plus, RefreshCw, ArrowRight, ShieldCheck } from "@/components/icons";

interface Investigation {
  id: string;
  title: string;
  status: string;
  submitted_type: string;
  created_at: string;
}

interface Report {
  id: string;
  investigation_id: string;
  version: number;
  format: string;
  status: string;
  created_at: string;
}

const ready = new Set(["COMPLETED", "PARTIALLY_COMPLETED", "NEEDS_REVIEW", "FAILED"]);

export default function ReportsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [items, saved] = await Promise.all([
        apiFetch<Investigation[]>("/investigations"),
        apiFetch<Report[]>("/reports"),
      ]);
      setInvestigations(items);
      setReports(saved);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : "Unable to load reports. Check API connection."
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const eligible = investigations.filter((item) => ready.has(item.status));

  async function createReport() {
    if (!selected) return;
    setBusy(true);
    try {
      const created = await apiFetch<Report>("/reports", {
        method: "POST",
        body: JSON.stringify({ investigation_id: selected }),
      });
      await refresh();
      window.location.href = `/reports/${created.id}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate report dossier.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceShell active="Report Center">
      <div className="page-content">
        <PageHeading
          eyebrow="INTELLIGENCE REPORTING & DOSSIERS"
          title="Reports Center"
          description="Synthesize completed investigation evidence into formal, timestamped intelligence dossiers with citations and export options."
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

        {/* Generate New Report Section */}
        <section className="panel report-create" style={{ marginBottom: "20px" }}>
          <div className="panel-head">
            <div>
              <h2>Compile Investigation Dossier</h2>
              <p>Choose any completed investigation to generate a verifiable dossier.</p>
            </div>
            <span className="status-badge orange">VERSIONED OUTPUT</span>
          </div>

          <div className="report-create-controls" style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
            <select
              aria-label="Select an investigation"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="text-input"
              style={{ flex: "1 1 300px" }}
            >
              <option value="">Choose an eligible investigation...</option>
              {eligible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} &bull; {item.status.replaceAll("_", " ")}
                </option>
              ))}
            </select>

            <button
              className="button button-primary"
              disabled={!selected || busy}
              onClick={() => void createReport()}
              type="button"
            >
              <FileText size={14} />
              {busy ? "Generating Dossier..." : "Generate Official Dossier"}
            </button>
          </div>

          {!eligible.length && (
            <p className="report-hint" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "10px" }}>
              No completed investigations yet. Run a claim or image investigation and wait for analysis to complete before generating a report.
            </p>
          )}
        </section>

        {/* Saved Reports List */}
        <section className="panel report-list-panel">
          <div className="panel-head">
            <div>
              <h2>Generated Intelligence Dossiers</h2>
              <p>Archive of immutable, cited investigation reports ready for PDF or JSON export</p>
            </div>
            <button className="button button-secondary button-sm" onClick={() => void refresh()} type="button">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {reports.length ? (
            <div className="report-list">
              {reports.map((report) => {
                const investigation = investigations.find(
                  (item) => item.id === report.investigation_id
                );
                return (
                  <Link
                    className="report-row"
                    key={report.id}
                    href={`/reports/${report.id}`}
                  >
                    <span className="report-row-icon">
                      <FileText size={16} />
                    </span>
                    <div className="report-row-main">
                      <b>{investigation?.title ?? "Investigation Dossier"}</b>
                      <small>
                        Version {report.version} &bull; {report.format.toUpperCase()} &bull; Created{" "}
                        {new Date(report.created_at).toLocaleString()}
                      </small>
                    </div>
                    <span className="status-badge green">{report.status.toUpperCase()}</span>
                    <span style={{ color: "var(--orange)", display: "flex", alignItems: "center" }}>
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
              <FileText size={32} style={{ margin: "0 auto 10px", opacity: 0.5 }} />
              <b>No reports generated yet</b>
              <p style={{ margin: "4px 0 0", fontSize: "11px" }}>
                Select a completed investigation above to compile your first verifiable dossier.
              </p>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
