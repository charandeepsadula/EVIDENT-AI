"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText
} from "@/components/icons";

interface InvestigationItem {
  id: string;
  title: string;
  submitted_type: string;
  status: string;
  progress: number;
  current_stage?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export function InvestigationHistoryList() {
  const [items, setItems] = useState<InvestigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = () => {
    setLoading(true);
    apiFetch<InvestigationItem[]>("/investigations")
      .then((rows) => {
        setItems(rows);
        setError("");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load investigations.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  async function deleteItem(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this investigation from the vault?")) {
      return;
    }
    setDeletingId(id);
    try {
      await apiFetch(`/investigations/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete investigation.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesType = typeFilter === "all" || item.submitted_type === typeFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "completed" && ["COMPLETED", "NEEDS_REVIEW", "PARTIALLY_COMPLETED"].includes(item.status)) ||
        (statusFilter === "active" && ["QUEUED", "PROCESSING", "ANALYZING"].includes(item.status)) ||
        (statusFilter === "failed" && item.status === "FAILED") ||
        item.status === statusFilter;
      const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase());
      return matchesType && matchesStatus && matchesQuery;
    });
  }, [items, typeFilter, statusFilter, query]);

  return (
    <div>
      {/* Search and Filters Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: "220px" }}>
          <input
            className="text-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search investigations by title or claim keywords..."
            style={{ paddingLeft: "34px" }}
          />
          <Search
            size={14}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
          />
        </div>

        <select
          className="text-input"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: "auto", minWidth: "140px" }}
        >
          <option value="all">All Types</option>
          <option value="text">Factual Claim (Text)</option>
          <option value="url">Website URL</option>
          <option value="image">Image Media</option>
        </select>

        <select
          className="text-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: "auto", minWidth: "150px" }}
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed / Needs Review</option>
          <option value="active">Active / In Progress</option>
          <option value="failed">Failed / Halt</option>
        </select>

        <button onClick={fetchItems} className="button button-secondary button-sm" type="button" title="Refresh">
          Refresh
        </button>
      </div>

      {error && (
        <div className="notice" style={{ borderColor: "var(--red-line)", background: "var(--red-bg)", marginBottom: "18px" }}>
          <span className="notice-symbol" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#EF4444" }}>!</span>
          <p>{error}</p>
        </div>
      )}

      {/* Investigation Records Table/Cards */}
      {loading ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--muted)" }}>
          Loading investigation vault...
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel" style={{ padding: "48px 24px", textAlign: "center" }}>
          <Search size={36} style={{ color: "var(--muted)", margin: "0 auto 12px", opacity: 0.5 }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "#FFF" }}>
            {items.length ? "No Matching Investigations" : "Investigation Vault is Empty"}
          </h2>
          <p style={{ fontSize: "12px", color: "var(--muted)", maxWidth: "420px", margin: "0 auto 20px" }}>
            {items.length
              ? "Try adjusting your search query or status filter."
              : "Launch an investigation to start logging traceable evidence and verification records."}
          </p>
          <Link href="/investigations/new" className="button button-primary">
            <Plus size={14} /> Start New Investigation
          </Link>
        </div>
      ) : (
        <div className="panel" style={{ padding: "8px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtered.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "14px",
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--line)",
                  transition: "background 0.15s ease",
                  borderRadius: "6px",
                }}
                className="history-item-row"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                  <span className="history-type">{item.submitted_type}</span>
                  <div style={{ minWidth: 0 }}>
                    <Link
                      href={`/investigations/${item.id}`}
                      style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF", display: "block", textDecoration: "none" }}
                    >
                      {item.title}
                    </Link>
                    <small style={{ color: "var(--muted)", fontSize: "10.5px" }}>
                      Created {new Date(item.created_at).toLocaleString()}
                      {item.current_stage ? ` &bull; ${item.current_stage}` : ""}
                    </small>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                  <span className={`status-badge ${item.status === "FAILED" ? "red" : item.progress === 100 ? "green" : "orange"}`}>
                    {item.status.replaceAll("_", " ")}
                  </span>

                  <span style={{ fontSize: "11px", color: "var(--muted)", minWidth: "35px", textAlign: "right" }}>
                    {item.progress}%
                  </span>

                  <Link href={`/investigations/${item.id}`} className="button button-secondary button-sm">
                    View Audit
                  </Link>

                  <button
                    onClick={(e) => deleteItem(item.id, e)}
                    disabled={deletingId === item.id}
                    className="button button-danger button-sm"
                    title="Delete investigation"
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
