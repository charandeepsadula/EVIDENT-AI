"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";

type Investigation = { id: string; title: string; status: string };
type RecordRow = Record<string, unknown>;
type Props = { kind: "evidence" | "sources" | "graph" | "timeline" };
const copy = {
  evidence: ["EVIDENCE INTELLIGENCE", "Evidence explorer", "Trace passages to their claims and source records."],
  sources: ["SOURCE INTELLIGENCE", "Source intelligence", "Review source material and publication metadata from saved investigations."],
  graph: ["RELATIONSHIP EXPLORER", "Evidence relationship graph", "Inspect persisted claim, source, and evidence links."],
  timeline: ["ORIGIN & CONTEXT", "Investigation timeline", "Review recorded processing events and discovered source appearances."],
} as const;

export function InvestigationExplorer({ kind }: Props) {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState<Record<string, unknown> | RecordRow[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refreshList = useCallback(async () => {
    try { const items = await apiFetch<Investigation[]>("/investigations"); setInvestigations(items); if (!selected && items[0]) setSelected(items[0].id); setError(""); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "Sign in and connect the API to inspect investigation data."); }
  }, [selected]);
  useEffect(() => { void refreshList(); }, [refreshList]);
  useEffect(() => {
    if (!selected) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    const endpoint = kind === "evidence" ? `/investigations/${selected}/evidence` : kind === "graph" ? `/investigations/${selected}/graph` : kind === "timeline" ? `/investigations/${selected}/timeline` : `/investigations/${selected}/results`;
    apiFetch<Record<string, unknown> | RecordRow[]>(endpoint).then(result => { if (!cancelled) { setData(result); setError(""); } }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load investigation data."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [kind, selected]);
  const [eyebrow, title, description] = copy[kind];
  return <WorkspaceShell active={kind === "evidence" ? "Evidence explorer" : kind === "sources" ? "Source intelligence" : kind === "graph" ? "Evidence graph" : "Truth timeline"}><div className="page-content">
    <PageHeading eyebrow={eyebrow} title={title} description={description} action={<Link className="button button-primary" href="/investigations/new">Start an investigation →</Link>} />
    {error && <div className="notice notice-info"><span className="notice-symbol">!</span><p>{error}</p><button className="button button-secondary" onClick={() => void refreshList()} type="button">Retry</button></div>}
    <section className="panel explorer-panel"><div className="panel-head"><div><h2>Investigation data</h2><p>Records shown here come from your authenticated API response.</p></div><select aria-label="Choose investigation" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Choose investigation</option>{investigations.map(item => <option key={item.id} value={item.id}>{item.title} · {item.status.replaceAll("_", " ")}</option>)}</select></div>
      {loading ? <div className="compact-empty">Loading saved records…</div> : !selected ? <div className="compact-empty">No investigations are available. Start one after connecting your account and services.</div> : kind === "evidence" ? <EvidenceRows rows={Array.isArray(data) ? data : []} /> : kind === "sources" ? <SourceRows rows={Array.isArray((data as Record<string, unknown> | null)?.sources) ? (data as Record<string, unknown>).sources as RecordRow[] : []} /> : kind === "graph" ? <GraphRows graph={(data ?? {}) as Record<string, unknown>} /> : <TimelineRows timeline={(data ?? {}) as Record<string, unknown>} />}
    </section>
  </div></WorkspaceShell>;
}
function EvidenceRows({ rows }: { rows: RecordRow[] }) { return rows.length ? <div className="explorer-list">{rows.map((row, i) => <article className="explorer-row" key={String(row.id ?? i)}><span className={`direction-chip ${String(row.direction ?? "neutral")}`}>{String(row.direction ?? "evidence")}</span><p>{String(row.extracted_passage ?? "No passage stored")}</p><small>Verification: {String(row.verification_status ?? "unverified")} · Citation: {String(row.citation_status ?? "unchecked")}</small>{row.source != null && <a target="_blank" rel="noreferrer" href={String((row.source as RecordRow).url)}>{String((row.source as RecordRow).title ?? (row.source as RecordRow).url)} ↗</a>}</article>)}</div> : <div className="compact-empty">No evidence records have been persisted for this investigation.</div>; }
function SourceRows({ rows }: { rows: RecordRow[] }) { return rows.length ? <div className="explorer-list">{rows.map((row, i) => <article className="explorer-row" key={String(row.id ?? i)}><a target="_blank" rel="noreferrer" href={String(row.url)}>{String(row.title ?? row.publisher ?? row.url)} ↗</a><p>{String(row.snippet ?? row.description ?? "No source summary stored")}</p><small>{String(row.publisher ?? "Publisher unknown")} · Retrieved {row.retrieved_at ? new Date(String(row.retrieved_at)).toLocaleString() : "date unavailable"}</small></article>)}</div> : <div className="compact-empty">No source records are available for this investigation.</div>; }
function GraphRows({ graph }: { graph: Record<string, unknown> }) { const nodes = Array.isArray(graph.nodes) ? graph.nodes as RecordRow[] : []; const edges = Array.isArray(graph.edges) ? graph.edges as RecordRow[] : []; return nodes.length ? <div className="explorer-list"><p className="explorer-count">{nodes.length} nodes · {edges.length} evidence links</p>{nodes.map((node, i) => <article className="explorer-row graph-row" key={String(node.id ?? i)}><span className="direction-chip context">{String(node.type)}</span><span>{String(node.label)}</span>{edges.filter(edge => edge.from === node.id || edge.to === node.id).map((edge, j) => <small key={j}>↔ {String(edge.relationship)} · linked record {String(edge.to === node.id ? edge.from : edge.to).slice(0, 8)}</small>)}</article>)}</div> : <div className="compact-empty">No persisted claim/source relationships to display.</div>; }
function TimelineRows({ timeline }: { timeline: Record<string, unknown> }) { const events = Array.isArray(timeline.events) ? timeline.events as RecordRow[] : []; const sources = Array.isArray(timeline.source_appearances) ? timeline.source_appearances as RecordRow[] : []; const rows: RecordRow[] = [...events.map(item => ({ ...item, _kind: "event" })), ...sources.map(item => ({ ...item, _kind: "source" }))].sort((a, b) => String((a as RecordRow).timestamp ?? (a as RecordRow).created_at ?? "").localeCompare(String((b as RecordRow).timestamp ?? (b as RecordRow).created_at ?? ""))); return rows.length ? <div className="explorer-list">{rows.map((row, i) => <article className="explorer-row timeline-row" key={String(row.id ?? i)}><time>{row.timestamp || row.created_at ? new Date(String(row.timestamp ?? row.created_at)).toLocaleString() : "Time unavailable"}</time><span className="direction-chip context">{String(row._kind)}</span><p>{String(row.title ?? row.message ?? row.event_type ?? "Recorded event")}</p>{row.url != null && <a href={String(row.url)} target="_blank" rel="noreferrer">Open source ↗</a>}</article>)}</div> : <div className="compact-empty">No timestamped events or discovered source appearances have been recorded.</div>; }
