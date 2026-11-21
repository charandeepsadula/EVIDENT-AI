import Link from "next/link";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";

const pages = {
  history: { active: "Investigation history", eyebrow: "INVESTIGATIONS", title: "Investigation history", description: "Review saved investigations and their processing status.", icon: "H", empty: "No saved investigations", detail: "Investigation history will appear here after account and database services are connected." },
  evidence: { active: "Evidence explorer", eyebrow: "EVIDENCE INTELLIGENCE", title: "Evidence explorer", description: "Browse source material and evidence linked to your investigations.", icon: "E", empty: "Evidence collection is empty", detail: "Evidence is recorded only after source research is connected and an investigation has run." },
  sources: { active: "Source intelligence", eyebrow: "SOURCE INTELLIGENCE", title: "Source intelligence", description: "Compare publishers, publication history, and source context.", icon: "S", empty: "No source profiles yet", detail: "Source assessments need collected, cited material. Reliability is not estimated without an explainable basis." },
  graph: { active: "Evidence graph", eyebrow: "RELATIONSHIP EXPLORER", title: "Evidence relationship graph", description: "Explore relationships among claims, sources, and evidence items.", icon: "G", empty: "No relationships to visualize", detail: "Graph nodes and links will be built from saved claims and evidence. No sample relationships are shown as real data." },
  timeline: { active: "Truth timeline", eyebrow: "ORIGIN & CONTEXT", title: "Investigation timeline", description: "Explore discovered appearances and changes over time.", icon: "T", empty: "No timeline data", detail: "Timelines require accessible sources and completed investigations. Earliest discovered does not necessarily mean original." },
  reports: { active: "Report center", eyebrow: "REPORTING", title: "Report center", description: "Access versioned reports and export investigation findings.", icon: "R", empty: "No reports available", detail: "Reports are generated from completed investigations and cite their stored evidence." },
  notifications: { active: "Notifications", eyebrow: "ACTIVITY", title: "Notifications", description: "Review investigation updates and human review requests.", icon: "N", empty: "No notifications", detail: "Investigation and review alerts will appear here when account and notification services are connected." },
  team: { active: "Team workspace", eyebrow: "COLLABORATION", title: "Team workspace", description: "Coordinate investigations, assignments, and annotations with your team.", icon: "T", empty: "No team workspace configured", detail: "Team membership and role-based access require authentication and organization data." },
  admin: { active: "Admin console", eyebrow: "ADMINISTRATION", title: "Admin console", description: "Authorized operators can monitor system usage, workers, and audit activity.", icon: "A", empty: "Admin services unavailable", detail: "Administrative data requires a secured admin role and connected backend. This local preview exposes no user or audit data." },
  api: { active: "Developer API", eyebrow: "DEVELOPER TOOLS", title: "API playground", description: "Explore versioned API endpoints and their current readiness.", icon: "API", empty: "FastAPI OpenAPI reference", detail: "Browse the running backend’s available routes, request schemas, and response contracts. Provider-backed operations still require their backend services to be configured." },
  settings: { active: "Settings", eyebrow: "WORKSPACE CONFIGURATION", title: "Settings & integrations", description: "Review what this local workspace needs before real investigations can run.", icon: "S", empty: "Connect services to continue", detail: "Configure backend services locally when ready." },
} as const;

const services = [
  { title: "Supabase", detail: "Authentication, PostgreSQL, and private file storage", need: "Optional for hosted multi-user accounts. Local SQLite handles single-user workspaces." },
  { title: "Gemini API", detail: "Structured AI claim extraction and evidence assessment", need: "Server-side only; verify provider readiness from a real investigation run" },
  { title: "Tavily research", detail: "Accessible-source search and submitted-page extraction", need: "Server-side only; verify provider readiness from a real investigation run" },
  { title: "Redis + workers", detail: "Durable queue for long-running hosted media analysis", need: "Not required by the local SQLite workspace" },
  { title: "Forensic services", detail: "OCR, transcription, and specialized detectors", need: "Capabilities are limited to the analysis tools configured and evaluated" },
];

export function WorkspacePage({ name }: { name: keyof typeof pages }) {
  const page = pages[name];
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  const local = !isSupabaseConfigured || process.env.NEXT_PUBLIC_LOCAL_DEV_MODE === "true";
  const settingsDescription = local
    ? "Local SQLite workspace is active. Gemini and Tavily credentials stay on the backend; provider readiness is confirmed by a real investigation run."
    : "Review the backend and hosted services configured for this workspace.";
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || (typeof window !== "undefined" && window.location.hostname.includes("onrender.com") ? "https://evident-ai-backend-s616.onrender.com/api/v1" : "http://127.0.0.1:8000/api/v1");
  const apiDocs = apiBase ? `${apiBase.replace(/\/api\/v1\/?$/, "")}/docs` : undefined;

  return (
    <WorkspaceShell active={page.active}>
      <div className="page-content">
        <PageHeading eyebrow={page.eyebrow} title={page.title} description={name === "settings" ? settingsDescription : page.description} />
        {name === "settings" ? (
          <div className="integration-grid">
            {services.map(({ title, detail, need }) => {
              const status = title === "Forensic services"
                ? "LIMITED MVP"
                : title === "Gemini API" || title === "Tavily research"
                ? "CHECK ON RUN"
                : title === "Supabase"
                ? (isSupabaseConfigured ? "CONFIGURED" : "OPTIONAL (LOCAL ACTIVE)")
                : local
                ? "NOT USED LOCALLY"
                : "NOT VERIFIED";
              return <article className="integration-card" key={title}>
                <div className="integration-top"><span className="integration-icon">{title.slice(0, 1)}</span><span className="status-badge">{status}</span></div>
                <h2>{title}</h2><p>{detail}</p><small>{need}</small>
              </article>;
            })}
          </div>
        ) : (
          <section className="panel empty-panel">
            <span className="empty-icon">{page.icon}</span><h2>{page.empty}</h2><p>{name === "api" && !apiDocs ? "Set NEXT_PUBLIC_API_BASE_URL to open the FastAPI documentation." : page.detail}</p>
            {name === "api" && apiDocs
              ? <a className="button button-secondary" href={apiDocs} target="_blank" rel="noreferrer">Open API documentation ↗</a>
              : <Link className="button button-primary" href="/investigations/new">Start an investigation →</Link>}
          </section>
        )}
      </div>
    </WorkspaceShell>
  );
}
