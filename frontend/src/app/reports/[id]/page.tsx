"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import { apiFetch } from "@/lib/api";

type SavedReport = { id: string; investigation_id: string; version: number; created_at: string; report_json: Record<string, unknown> };
export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<SavedReport | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => { try { setReport(await apiFetch<SavedReport>(`/reports/${id}`)); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load report."); } }, [id]);
  useEffect(() => { void refresh(); }, [refresh]);
  const data = report?.report_json;
  function download() { if (!report) return; const blob = new Blob([JSON.stringify(report.report_json, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `evident-report-${report.id}.json`; link.click(); URL.revokeObjectURL(url); }
  return <WorkspaceShell active="Report center"><div className="page-content"><div className="back-link-row"><Link href="/reports">← Report center</Link></div>
    <PageHeading eyebrow="SAVED REPORT" title={String((data?.investigation as Record<string, unknown> | undefined)?.title ?? "Investigation report")} description={report ? `Version ${report.version} · Generated ${new Date(report.created_at).toLocaleString()}` : "Loading saved report…"} action={report ? <div className="report-actions"><button className="button button-secondary" onClick={download} type="button">Export JSON ↓</button><button className="button button-primary" onClick={() => window.print()} type="button">Print / Save PDF</button></div> : undefined} />
    {error && <div className="notice notice-info"><span className="notice-symbol">!</span><p>{error}</p><button className="button button-secondary" onClick={() => void refresh()} type="button">Retry</button></div>}
    {data && <article className="report-document"><div className="report-document-header"><span>EVIDENT AI · INVESTIGATION REPORT</span><small>Report ID {report?.id} · Version {report?.version}</small></div>
      <section><h2>Executive summary</h2><p>{String(data.executive_summary ?? "")}</p></section>
      <section><h2>Investigation</h2><pre>{JSON.stringify(data.investigation, null, 2)}</pre></section>
      <ReportArray title="Claims" items={data.claims} empty="No claims were persisted." render={item => <div className="report-item"><b>{String(item.factual_verdict ?? "UNVERIFIED").replaceAll("_", " ")}</b><p>{String(item.text ?? "")}</p><small>{String(item.reasoning_summary ?? item.uncertainty ?? "")}</small></div>} />
      <ReportArray title="Sources" items={data.sources} empty="No source records were persisted." render={item => <div className="report-item"><a href={String(item.url ?? "#")} target="_blank" rel="noreferrer">{String(item.title ?? item.publisher ?? item.url ?? "Source")}</a><small>{String(item.url ?? "")}</small></div>} />
      <ReportArray title="Evidence" items={data.evidence} empty="No evidence records were persisted." render={item => <div className="report-item"><b>{String(item.direction ?? "Evidence")} · {String(item.verification_status ?? "unverified")}</b><p>{String(item.extracted_passage ?? "")}</p></div>} />
      <ReportArray title="Media forensic indicators" items={data.forensic_results} empty="No forensic indicators were recorded." render={item => <div className="report-item"><b>{String(item.indicator ?? "Indicator")}</b><p>{String(item.finding ?? "")}</p></div>} />
      <ReportArray title="Limitations" items={data.limitations} empty="Limitations were not recorded." render={item => <p className="report-item">{String(item)}</p>} />
      <p className="report-disclaimer">This report summarizes persisted system outputs. Forensic indicators are not proof of authenticity or manipulation. Confirm citations and conduct human review before relying on conclusions.</p>
    </article>}
  </div></WorkspaceShell>;
}
function ReportArray({ title, items, empty, render }: { title: string; items: unknown; empty: string; render: (item: Record<string, unknown>) => ReactNode }) {
  const rows = Array.isArray(items) ? items as Record<string, unknown>[] : [];
  return <section><h2>{title}</h2>{rows.length ? rows.map((item, index) => <div key={String(item.id ?? index)}>{render(item)}</div>) : <p className="report-empty">{empty}</p>}</section>;
}
