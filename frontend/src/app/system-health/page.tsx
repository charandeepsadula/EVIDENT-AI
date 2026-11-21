"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import {
  Activity,
  Cpu,
  Database,
  Globe,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ArrowRight
} from "@/components/icons";

interface HealthData {
  status: string;
  service: string;
  version: string;
  environment: string;
  local_dev_mode: boolean;
  database: { connected: boolean; detail: string; type: string };
  gemini: { configured: boolean; model: string; fallback_model?: string; key_status: string };
  tavily: { configured: boolean; key_status: string };
  model: string;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // Playground state
  const [endpoint, setEndpoint] = useState("/system/health");
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responsePayload, setResponsePayload] = useState<string | null>(null);
  const [runningTest, setRunningTest] = useState(false);

  const fetchHealth = () => {
    setLoading(true);
    const start = performance.now();
    apiFetch<HealthData>("/system/health")
      .then((data) => {
        setHealth(data);
        setPingLatency(Math.round(performance.now() - start));
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Backend unreachable.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const runEndpointTest = async () => {
    setRunningTest(true);
    setResponsePayload(null);
    try {
      const base = getApiBaseUrl();
      const token = process.env.NEXT_PUBLIC_LOCAL_DEV_TOKEN || "local-workspace-token";
      const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const res = await fetch(`${base}${normalizedEndpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      setResponseStatus(res.status);
      const text = await res.text();
      try {
        setResponsePayload(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponsePayload(text);
      }
    } catch (err) {
      setResponseStatus(503);
      setResponsePayload(err instanceof Error ? err.message : "Network error");
    } finally {
      setRunningTest(false);
    }
  };

  return (
    <WorkspaceShell active="System Health & API">
      <div className="page-content">
        <PageHeading
          eyebrow="SYSTEM TELEMETRY & API PLAYGROUND"
          title="System Health & API Status"
          description="Live diagnostic metrics, provider latency measurements, and interactive REST API endpoint inspection."
          action={
            <button className="button button-secondary button-sm" onClick={fetchHealth} type="button">
              <RefreshCw size={13} /> Re-Check Telemetry
            </button>
          }
        />

        {error && (
          <div className="notice" style={{ borderColor: "var(--red-line)", background: "var(--red-bg)" }}>
            <span className="notice-symbol" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#EF4444" }}>!</span>
            <p>
              <b>API Gateway Unreachable:</b> {error} (Ensure backend server is running on <code>127.0.0.1:8000</code>).
            </p>
          </div>
        )}

        {/* Live Diagnostics Cards */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-top">
              <span>API GATEWAY STATUS</span>
              <div className="metric-icon-box" style={{ color: health?.status === "ok" ? "var(--green)" : "var(--orange)" }}>
                <Activity size={15} />
              </div>
            </div>
            <strong style={{ color: health?.status === "ok" ? "var(--green)" : "var(--orange)" }}>
              {loading ? "..." : health?.status === "ok" ? "OPERATIONAL" : "DEGRADED"}
            </strong>
            <small>Latency: {pingLatency !== null ? `${pingLatency} ms` : "Measuring..."}</small>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>SQLITE DATABASE</span>
              <div className="metric-icon-box" style={{ color: "var(--green)" }}>
                <Database size={15} />
              </div>
            </div>
            <strong style={{ color: "var(--green)" }}>
              {loading ? "..." : health?.database.connected ? "CONNECTED" : "OFFLINE"}
            </strong>
            <small>{health?.database.detail ?? "SQLite database"}</small>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>GEMINI AI SERVICE</span>
              <div className="metric-icon-box" style={{ color: "var(--orange)" }}>
                <Cpu size={15} />
              </div>
            </div>
            <strong style={{ color: health?.gemini.configured ? "var(--orange)" : "var(--muted)" }}>
              {loading ? "..." : health?.gemini.configured ? "ONLINE" : "PENDING"}
            </strong>
            <small>Model: {health?.gemini.model ?? "gemini-3.8-flash"}</small>
          </div>

          <div className="metric-card">
            <div className="metric-top">
              <span>TAVILY RESEARCH API</span>
              <div className="metric-icon-box" style={{ color: "var(--blue)" }}>
                <Globe size={15} />
              </div>
            </div>
            <strong style={{ color: health?.tavily.configured ? "var(--blue)" : "var(--muted)" }}>
              {loading ? "..." : health?.tavily.configured ? "ACTIVE" : "PENDING"}
            </strong>
            <small>Key: {health?.tavily.key_status ?? "Configured"}</small>
          </div>
        </div>

        {/* Interactive API Playground */}
        <section className="panel" style={{ marginTop: "24px" }}>
          <div className="panel-head">
            <div>
              <h2>Interactive REST API Tester</h2>
              <p>Execute live authenticated requests against backend endpoints and inspect payloads.</p>
            </div>
            <span className="status-badge orange">OPENAPI 3.1</span>
          </div>

          <div style={{ display: "flex", gap: "10px", margin: "18px 0 14px", flexWrap: "wrap" }}>
            <select
              className="text-input"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              style={{ flex: "1 1 320px" }}
            >
              <option value="/system/health">GET /api/v1/system/health (System status)</option>
              <option value="/system/stats">GET /api/v1/system/stats (Vault metrics & statistics)</option>
              <option value="/investigations">GET /api/v1/investigations (List all investigations)</option>
              <option value="/evidence">GET /api/v1/evidence (Cross-investigation evidence)</option>
              <option value="/reports">GET /api/v1/reports (Generated report list)</option>
            </select>

            <button
              className="button button-primary"
              onClick={runEndpointTest}
              disabled={runningTest}
              type="button"
            >
              <Activity size={14} />
              {runningTest ? "Calling API..." : "Send Request"}
            </button>
          </div>

          {responseStatus !== null && (
            <div style={{ marginTop: "14px", background: "var(--panel2)", borderRadius: "7px", padding: "14px", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>HTTP Response Status:</span>
                <span className={`status-badge ${responseStatus === 200 ? "green" : "red"}`}>
                  HTTP {responseStatus}
                </span>
              </div>
              <pre
                style={{
                  background: "#070B12",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  maxHeight: "320px",
                  overflow: "auto",
                  fontSize: "11.5px",
                  color: "#CBD5E1",
                  fontFamily: "monospace",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {responsePayload}
              </pre>
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
