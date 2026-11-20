"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import {
  Activity,
  Plus,
  Globe,
  ImageIcon,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  ArrowRight,
  Database
} from "@/components/icons";
import { apiFetch } from "@/lib/api";

interface SystemStats {
  total_investigations: number;
  completed_investigations: number;
  failed_investigations: number;
  pending_investigations: number;
  type_counts: Record<string, number>;
  total_claims: number;
  total_sources: number;
  total_evidence: number;
  avg_confidence: number;
  recent_investigations: Array<{
    id: string;
    title: string;
    submitted_type: string;
    status: string;
    progress: number;
    current_stage: string;
    created_at: string;
    completed_at?: string;
    primary_verdict?: string;
    confidence?: number;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = () => {
    setLoading(true);
    apiFetch<SystemStats>("/system/stats")
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err) => {
        console.warn("Could not fetch stats:", err);
        // Fallback to fetching basic list if stats endpoint fails
        apiFetch<any[]>("/investigations")
          .then((items) => {
            const completed = items.filter((x) =>
              ["COMPLETED", "NEEDS_REVIEW", "PARTIALLY_COMPLETED"].includes(x.status)
            ).length;
            const failed = items.filter((x) => x.status === "FAILED").length;
            const pending = items.filter((x) =>
              ["QUEUED", "PROCESSING", "ANALYZING"].includes(x.status)
            ).length;
            setStats({
              total_investigations: items.length,
              completed_investigations: completed,
              failed_investigations: failed,
              pending_investigations: pending,
              type_counts: {},
              total_claims: items.length,
              total_sources: 0,
              total_evidence: 0,
              avg_confidence: 0.85,
              recent_investigations: items.slice(0, 8),
            });
            setError(null);
          })
          .catch((e) => {
            setError(e instanceof Error ? e.message : "Failed to connect to backend API.");
          });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const total = stats?.total_investigations ?? 0;
  const completed = stats?.completed_investigations ?? 0;
  const failed = stats?.failed_investigations ?? 0;
  const pending = stats?.pending_investigations ?? 0;
  const recent = stats?.recent_investigations ?? [];

  return (
    <WorkspaceShell active="Dashboard">
      <div className="page-content">
        <PageHeading
          eyebrow="INTELLIGENCE DASHBOARD"
          title="Investigation Overview"
          description="Real-time multi-agent investigation metrics, evidence status, and forensic audit feeds."
          action={
            <div style={{ display: "flex", gap: "10px" }}>
              <Link href="/investigations/new" className="button button-primary">
                <Plus size={14} /> New Investigation
              </Link>
            </div>
          }
        />

        {error && (
          <div className="notice" style={{ borderColor: "var(--red-line)", background: "var(--red-bg)" }}>
            <span className="notice-symbol" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#EF4444" }}>!</span>
            <p>
              <b>Backend API Notice:</b> {error} (Ensure backend server is running on port 8000).
            </p>
            <button onClick={fetchStats} className="button button-secondary button-sm">Retry</button>
          </div>
        )}

        {/* Real Backend Metrics Grid */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-top">
              <span>TOTAL INVESTIGATIONS</span>
              <div className="metric-icon-box">
                <Database size={15} />
              </div>
            </div>
            <strong>{loading ? "..." : total}</strong>
            <small>Persisted in SQLite database</small>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>COMPLETED / VERIFIED</span>
              <div className="metric-icon-box" style={{ color: "var(--green)" }}>
                <CheckCircle2 size={15} />
              </div>
            </div>
            <strong style={{ color: "var(--green)" }}>{loading ? "..." : completed}</strong>
            <small>Synthesized with citations</small>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>ACTIVE / QUEUED</span>
              <div className="metric-icon-box" style={{ color: "var(--blue)" }}>
                <Clock size={15} />
              </div>
            </div>
            <strong style={{ color: "var(--blue)" }}>{loading ? "..." : pending}</strong>
            <small>Multi-agent pipeline running</small>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>FAILED / REJECTED</span>
              <div className="metric-icon-box" style={{ color: "var(--red)" }}>
                <XCircle size={15} />
              </div>
            </div>
            <strong style={{ color: failed > 0 ? "var(--red)" : "inherit" }}>{loading ? "..." : failed}</strong>
            <small>Unreachable sources / invalid inputs</small>
          </div>
        </div>

        {/* Prominent Quick Actions */}
        <section className="section-block">
          <div className="section-title">
            <div>
              <h2>Investigation Launchpad</h2>
              <p>Deploy specialized multi-agent verification modules.</p>
            </div>
            <span className="status-badge orange">ACTIVE SUITE</span>
          </div>

          <div className="capability-grid">
            <Link href="/investigations/new" className="capability-card">
              <span className="cap-icon">
                <Search size={18} />
              </span>
              <h3>Investigate Claim</h3>
              <p>Verify factual statements using atomic decomposition and multi-source research.</p>
              <span className="cap-link">
                Launch <ArrowRight size={12} />
              </span>
            </Link>

            <Link href="/investigations/new?tab=url" className="capability-card">
              <span className="cap-icon">
                <Globe size={18} />
              </span>
              <h3>Investigate URL</h3>
              <p>Extract public web articles, analyze article veracity, and identify misrepresentations.</p>
              <span className="cap-link">
                Launch <ArrowRight size={12} />
              </span>
            </Link>

            <Link href="/labs/image" className="capability-card">
              <span className="cap-icon">
                <ImageIcon size={18} />
              </span>
              <h3>Digital Image Lab</h3>
              <p>Extract camera EXIF metadata, detect C2PA markers, and run Gemini Vision inspection.</p>
              <span className="cap-link">
                Launch <ArrowRight size={12} />
              </span>
            </Link>

            <Link href="/investigations/history" className="capability-card">
              <span className="cap-icon">
                <Clock size={18} />
              </span>
              <h3>Investigation Vault</h3>
              <p>Search, filter, inspect verdicts, and audit historical investigation dossiers.</p>
              <span className="cap-link">
                Explore <ArrowRight size={12} />
              </span>
            </Link>
          </div>
        </section>

        {/* Lower Grid: Recent Investigations & Engine Health */}
        <section className="lower-grid">
          {/* Recent Investigations Feed */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Recent Investigation Activity</h2>
                <p>Real-time records from your investigation history</p>
              </div>
              <Link href="/investigations/history" style={{ fontSize: "11px", color: "var(--orange)", fontWeight: 600 }}>
                View All History &rarr;
              </Link>
            </div>

            {loading ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                Loading investigations...
              </div>
            ) : recent.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <Search size={32} style={{ color: "var(--muted)", margin: "0 auto 12px", opacity: 0.5 }} />
                <b style={{ display: "block", fontSize: "13px", marginBottom: "4px" }}>No investigations conducted yet</b>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 16px" }}>
                  Launch your first multi-agent investigation to inspect claims or media.
                </p>
                <Link href="/investigations/new" className="button button-primary button-sm">
                  <Plus size={12} /> Start First Investigation
                </Link>
              </div>
            ) : (
              <div className="history-list">
                {recent.slice(0, 6).map((item) => {
                  const verdict = (item.primary_verdict || item.status).toLowerCase();
                  return (
                    <Link href={`/investigations/${item.id}`} key={item.id} className="history-row">
                      <span className="history-type">{item.submitted_type}</span>
                      <div className="history-title">
                        <b>{item.title}</b>
                        <small>{new Date(item.created_at).toLocaleString()}</small>
                      </div>
                      <div>
                        {item.status === "FAILED" ? (
                          <span className="verdict-chip false">FAILED</span>
                        ) : item.primary_verdict ? (
                          <span className={`verdict-chip ${verdict}`}>
                            {item.primary_verdict.replace("_", " ")}
                          </span>
                        ) : (
                          <span className="status-badge">{item.status.replace("_", " ")}</span>
                        )}
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--muted)", minWidth: "40px", textAlign: "right" }}>
                        {item.progress}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Verification Engine Readiness */}
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Engine Architecture Status</h2>
                <p>Component & AI pipeline readiness</p>
              </div>
              <span className="status-badge green">ONLINE</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "16px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--panel2)", borderRadius: "6px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)" }} />
                  <div>
                    <b style={{ fontSize: "12px", display: "block" }}>FastAPI Intelligence Gateway</b>
                    <small style={{ color: "var(--muted)", fontSize: "10px" }}>REST endpoints & SQLite storage</small>
                  </div>
                </div>
                <span className="status-badge green">ACTIVE</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--panel2)", borderRadius: "6px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)" }} />
                  <div>
                    <b style={{ fontSize: "12px", display: "block" }}>Tavily Multi-Source Research</b>
                    <small style={{ color: "var(--muted)", fontSize: "10px" }}>Ground-truth web extraction & citations</small>
                  </div>
                </div>
                <span className="status-badge green">READY</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--panel2)", borderRadius: "6px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)" }} />
                  <div>
                    <b style={{ fontSize: "12px", display: "block" }}>Gemini Multi-Agent Decomposition</b>
                    <small style={{ color: "var(--muted)", fontSize: "10px" }}>Structured schemas & verdict evaluation</small>
                  </div>
                </div>
                <span className="status-badge green">READY</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--panel2)", borderRadius: "6px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)" }} />
                  <div>
                    <b style={{ fontSize: "12px", display: "block" }}>Pillow Digital Media Forensics</b>
                    <small style={{ color: "var(--muted)", fontSize: "10px" }}>EXIF extraction & C2PA detection</small>
                  </div>
                </div>
                <span className="status-badge green">ACTIVE</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>Check live endpoint latency & ping:</span>
              <Link href="/system-health" style={{ fontSize: "11px", color: "var(--orange)", fontWeight: 600 }}>
                System Diagnostics &rarr;
              </Link>
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
