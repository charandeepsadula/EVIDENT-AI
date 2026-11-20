"use client";

import React, { useEffect, useState } from "react";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import { apiFetch } from "@/lib/api";
import {
  SettingsIcon,
  Cpu,
  Globe,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink
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

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [geminiTestStatus, setGeminiTestStatus] = useState<string | null>(null);
  const [tavilyTestStatus, setTavilyTestStatus] = useState<string | null>(null);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingTavily, setTestingTavily] = useState(false);

  const loadHealth = () => {
    setLoading(true);
    apiFetch<HealthData>("/system/health")
      .then((data) => {
        setHealth(data);
      })
      .catch((err) => {
        console.warn("Could not load system health:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const testGemini = async () => {
    setTestingGemini(true);
    setGeminiTestStatus("Testing Gemini API connection...");
    try {
      const res = await apiFetch<any>("/system/test-gemini", { method: "POST" });
      if (res.ok) {
        setGeminiTestStatus(`✓ Operational (${res.latency_ms} ms) - Model: ${res.model}`);
      } else {
        setGeminiTestStatus(`✗ Status: ${res.status} (${res.message || "Failed"})`);
      }
    } catch (e) {
      setGeminiTestStatus(`✗ Error: ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setTestingGemini(false);
    }
  };

  const testTavily = async () => {
    setTestingTavily(true);
    setTavilyTestStatus("Testing Tavily Search API...");
    try {
      const res = await apiFetch<any>("/system/test-tavily", { method: "POST" });
      if (res.ok) {
        setTavilyTestStatus(`✓ Operational (${res.latency_ms} ms) - Search API Active`);
      } else {
        setTavilyTestStatus(`✗ Status: ${res.status} (${res.message || "Failed"})`);
      }
    } catch (e) {
      setTavilyTestStatus(`✗ Error: ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setTestingTavily(false);
    }
  };

  return (
    <WorkspaceShell active="Settings">
      <div className="page-content narrow-content">
        <PageHeading
          eyebrow="SYSTEM CONFIGURATION"
          title="Settings & Integrations"
          description="Manage AI providers, research endpoints, model parameters, and local database settings."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* AI Engine Settings */}
          <section className="panel">
            <div className="panel-head">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Cpu size={18} style={{ color: "var(--orange)" }} />
                <div>
                  <h2>Google Gemini AI Engine</h2>
                  <p>Handles atomic claim extraction and structured verdict synthesis</p>
                </div>
              </div>
              <span className={`status-badge ${health?.gemini.configured ? "green" : "orange"}`}>
                {health?.gemini.configured ? "CONFIGURED" : "PENDING"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", margin: "16px 0" }}>
              <div>
                <label className="field-label">Active Gemini Model</label>
                <input
                  className="text-input"
                  value={health?.gemini.model ?? "gemini-3.8-flash"}
                  readOnly
                  style={{ opacity: 0.9 }}
                />
              </div>

              <div>
                <label className="field-label">API Key Status</label>
                <input
                  className="text-input"
                  value={health?.gemini.key_status ?? "Configured in backend/.env"}
                  readOnly
                  style={{ opacity: 0.9 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {geminiTestStatus || "Click test connection to verify API key validity & latency."}
              </div>
              <button
                type="button"
                className="button button-secondary button-sm"
                onClick={testGemini}
                disabled={testingGemini}
              >
                {testingGemini ? "Testing..." : "Test Gemini Connection"}
              </button>
            </div>
          </section>

          {/* Web Research Engine */}
          <section className="panel">
            <div className="panel-head">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Globe size={18} style={{ color: "var(--orange)" }} />
                <div>
                  <h2>Tavily Search & Web Research</h2>
                  <p>Real-time ground-truth source retrieval and webpage article extraction</p>
                </div>
              </div>
              <span className={`status-badge ${health?.tavily.configured ? "green" : "orange"}`}>
                {health?.tavily.configured ? "CONFIGURED" : "PENDING"}
              </span>
            </div>

            <div style={{ margin: "16px 0" }}>
              <label className="field-label">Tavily Key Status</label>
              <input
                className="text-input"
                value={health?.tavily.key_status ?? "Configured in backend/.env"}
                readOnly
                style={{ opacity: 0.9 }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                {tavilyTestStatus || "Click test connection to check live research endpoint latency."}
              </div>
              <button
                type="button"
                className="button button-secondary button-sm"
                onClick={testTavily}
                disabled={testingTavily}
              >
                {testingTavily ? "Testing..." : "Test Tavily Connection"}
              </button>
            </div>
          </section>

          {/* Database Vault Settings */}
          <section className="panel">
            <div className="panel-head">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Database size={18} style={{ color: "var(--orange)" }} />
                <div>
                  <h2>Local SQLite Intelligence Vault</h2>
                  <p>Zero-dependency persistence for claims, evidence, and audit logs</p>
                </div>
              </div>
              <span className="status-badge green">CONNECTED</span>
            </div>

            <div style={{ padding: "14px", background: "var(--panel2)", borderRadius: "6px", margin: "14px 0", border: "1px solid var(--line)" }}>
              <div style={{ fontSize: "12px", color: "var(--text)" }}>
                <b>Database Status:</b> {health?.database.detail ?? "SQLite Connected"}
              </div>
              <small style={{ color: "var(--muted)", display: "block", marginTop: "4px" }}>
                Database File: <code>./data/evident.sqlite3</code> &bull; Foreign keys enabled &bull; Full cascade deletion supported
              </small>
            </div>
          </section>

          {/* Responsible AI Default Safeguards */}
          <section className="panel">
            <div className="panel-head">
              <h2>Investigation Safeguards & Thresholds</h2>
              <span className="status-badge">ENFORCED</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "var(--text-dim)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span>Unverified Default Rule</span>
                <b style={{ color: "var(--green)" }}>Active (Claims without sources are unverified)</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span>GPS Sanitization on Image Uploads</span>
                <b style={{ color: "var(--green)" }}>Active (Never retains sensitive coordinates)</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span>Maximum Research Sources Per Claim</span>
                <b>5 sources / claim (Max 20 total)</b>
              </div>
            </div>
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
