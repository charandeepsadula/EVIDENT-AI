"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import {
  Database,
  Search,
  Filter,
  ExternalLink,
  Plus,
  CheckCircle2,
  XCircle,
  Globe
} from "@/components/icons";
import { apiFetch } from "@/lib/api";

interface EvidenceItem {
  id: string;
  direction: string;
  extracted_passage: string | null;
  citation_status: string;
  verification_status: string;
  created_at: string;
  claim_text?: string | null;
  factual_verdict?: string | null;
  claim_confidence?: number | null;
  source_url?: string | null;
  source_title?: string | null;
  source_publisher?: string | null;
  source_published_at?: string | null;
  investigation_id: string;
  investigation_title: string;
  submitted_type: string;
}

export default function EvidenceExplorerPage() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "supporting" | "contradicting">("all");
  const [selectedPublisher, setSelectedPublisher] = useState<string>("all");

  const fetchEvidence = () => {
    setLoading(true);
    apiFetch<EvidenceItem[]>("/evidence")
      .then((data) => {
        setItems(data);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load evidence repository.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  // Compute publisher domain frequency
  const publishers = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.source_publisher) {
        counts[item.source_publisher] = (counts[item.source_publisher] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [items]);

  // Filter evidence records
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesDir = directionFilter === "all" || item.direction === directionFilter;
      const matchesPub = selectedPublisher === "all" || item.source_publisher === selectedPublisher;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (item.extracted_passage?.toLowerCase().includes(q) ?? false) ||
        (item.claim_text?.toLowerCase().includes(q) ?? false) ||
        (item.source_title?.toLowerCase().includes(q) ?? false) ||
        (item.investigation_title?.toLowerCase().includes(q) ?? false);
      return matchesDir && matchesPub && matchesSearch;
    });
  }, [items, directionFilter, selectedPublisher, search]);

  return (
    <WorkspaceShell active="Evidence Explorer">
      <div className="page-content">
        <PageHeading
          eyebrow="CROSS-INVESTIGATION INTELLIGENCE"
          title="Evidence Explorer"
          description="Browse and audit ground-truth research citations, quoted passages, and publisher records across all investigations."
          action={
            <Link href="/investigations/new" className="button button-primary">
              <Plus size={14} /> New Investigation
            </Link>
          }
        />

        {error && (
          <div className="notice" style={{ borderColor: "var(--red-line)", background: "var(--red-bg)" }}>
            <span className="notice-symbol" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#EF4444" }}>!</span>
            <p>{error}</p>
          </div>
        )}

        {/* Filter & Search Controls */}
        <div className="panel" style={{ marginBottom: "20px", padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 260px" }}>
              <input
                className="text-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search quoted passages, claims, or source titles..."
                style={{ paddingLeft: "34px" }}
              />
              <Search
                size={14}
                style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
              />
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                className={`button button-sm ${directionFilter === "all" ? "button-primary" : "button-secondary"}`}
                onClick={() => setDirectionFilter("all")}
              >
                All Direction ({items.length})
              </button>
              <button
                type="button"
                className={`button button-sm ${directionFilter === "supporting" ? "button-primary" : "button-secondary"}`}
                onClick={() => setDirectionFilter("supporting")}
              >
                Supporting ({items.filter((x) => x.direction === "supporting").length})
              </button>
              <button
                type="button"
                className={`button button-sm ${directionFilter === "contradicting" ? "button-primary" : "button-secondary"}`}
                onClick={() => setDirectionFilter("contradicting")}
              >
                Contradicting ({items.filter((x) => x.direction === "contradicting").length})
              </button>
            </div>
          </div>

          {/* Publisher Domain Frequency Chips */}
          {publishers.length > 0 && (
            <div style={{ marginTop: "14px", borderTop: "1px solid var(--line)", paddingTop: "12px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Top Cited Publishers:</span>
              <button
                type="button"
                className={`preset-chip ${selectedPublisher === "all" ? "active" : ""}`}
                style={{
                  background: selectedPublisher === "all" ? "var(--orange-subtle)" : "var(--panel2)",
                  borderColor: selectedPublisher === "all" ? "var(--orange)" : "var(--line)",
                  color: selectedPublisher === "all" ? "var(--orange)" : "inherit",
                }}
                onClick={() => setSelectedPublisher("all")}
              >
                All Publishers
              </button>
              {publishers.slice(0, 8).map(([pub, count]) => (
                <button
                  key={pub}
                  type="button"
                  className="preset-chip"
                  style={{
                    background: selectedPublisher === pub ? "var(--orange-subtle)" : "var(--panel2)",
                    borderColor: selectedPublisher === pub ? "var(--orange)" : "var(--line)",
                    color: selectedPublisher === pub ? "var(--orange)" : "inherit",
                  }}
                  onClick={() => setSelectedPublisher(pub)}
                >
                  {pub} ({count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Evidence List */}
        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
            Loading cross-investigation evidence...
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel" style={{ padding: "48px 20px", textAlign: "center" }}>
            <Database size={36} style={{ color: "var(--muted)", margin: "0 auto 12px", opacity: 0.5 }} />
            <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "#FFF" }}>
              {items.length ? "No Matching Evidence Found" : "No Evidence Gathered Yet"}
            </h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", maxWidth: "420px", margin: "0 auto 18px" }}>
              {items.length
                ? "Try clearing the search query or publisher filter."
                : "Evidence will be recorded and indexed automatically as claims and URLs are investigated."}
            </p>
            <Link href="/investigations/new" className="button button-primary">
              <Plus size={14} /> Launch Investigation
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filtered.map((item) => {
              const dir = item.direction.toLowerCase();
              return (
                <div key={item.id} className="panel" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={`direction-chip ${dir}`}>{dir}</span>
                      <span className="status-badge" style={{ fontSize: "8.5px" }}>
                        CITATION {item.citation_status}
                      </span>
                      {item.source_publisher && (
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          Publisher: <b style={{ color: "var(--text)" }}>{item.source_publisher}</b>
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/investigations/${item.investigation_id}`}
                      style={{ fontSize: "11px", color: "var(--orange)", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      Investigation: {item.investigation_title.slice(0, 40)}... &rarr;
                    </Link>
                  </div>

                  {item.claim_text && (
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#FFFFFF", marginBottom: "8px" }}>
                      Claim: &ldquo;{item.claim_text}&rdquo;
                    </div>
                  )}

                  {item.extracted_passage && (
                    <div className="evidence-passage" style={{ margin: "6px 0 10px" }}>
                      &ldquo;{item.extracted_passage}&rdquo;
                    </div>
                  )}

                  {item.source_url && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="source-link"
                      >
                        <ExternalLink size={12} /> {item.source_title || item.source_url}
                      </a>
                      <small style={{ color: "#64748B", fontSize: "10px" }}>
                        Recorded {new Date(item.created_at).toLocaleString()}
                      </small>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
