import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Clock,
  Database,
  ImageIcon,
  FileText,
  SettingsIcon,
  Activity,
  Plus,
  Globe
} from "@/components/icons";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <Activity size={16} /> },
  { label: "New Investigation", href: "/investigations/new", icon: <Plus size={16} /> },
  { label: "Investigation History", href: "/investigations/history", icon: <Clock size={16} /> },
  { label: "Evidence Explorer", href: "/evidence", icon: <Database size={16} /> },
  { label: "Report Center", href: "/reports", icon: <FileText size={16} /> },
];

const toolNav: NavItem[] = [
  { label: "Claim & Text", href: "/investigations/new", icon: <Search size={16} /> },
  { label: "URL Investigation", href: "/investigations/new?tab=url", icon: <Globe size={16} /> },
  { label: "Image Lab", href: "/labs/image", icon: <ImageIcon size={16} /> },
];

const systemNav: NavItem[] = [
  { label: "Settings", href: "/settings", icon: <SettingsIcon size={16} /> },
  { label: "System Health & API", href: "/system-health", icon: <Activity size={16} /> },
];

export function WorkspaceShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">E</span>
          <span>
            EVIDENT<span className="brand-light"> AI</span>
            <small>INTELLIGENCE PLATFORM</small>
          </span>
        </Link>

        <div className="workspace-select">
          <span className="workspace-avatar">E</span>
          <div>
            <b>Intelligence Vault</b>
            <small>Local SQLite MVP</small>
          </div>
          <span className="select-caret">▾</span>
        </div>

        <nav>
          <div className="nav-group">
            <p className="nav-label">WORKSPACE</p>
            {mainNav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-link ${active === item.label ? "active" : ""}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="nav-group">
            <p className="nav-label">FORENSIC TOOLS</p>
            {toolNav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-link ${active === item.label ? "active" : ""}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          <div className="nav-group">
            <p className="nav-label">SYSTEM & CONFIG</p>
            {systemNav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-link ${active === item.label ? "active" : ""}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="service-status">
            <span className="status-dot green" />
            <div>
              <b>EVIDENT AI Engine</b>
              <small>Gemini + Tavily Ready</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <Link href="/" style={{ opacity: 0.8 }}>Evident AI</Link>
            <span className="slash">/</span>
            <b>{active ?? "Dashboard"}</b>
          </div>

          <div className="top-actions">
            <span className="environment-pill">
              <i /> Local Workspace
            </span>
            <Link className="button button-secondary button-sm" href="/investigations/new">
              <Plus size={13} />
              New Claim
            </Link>
            <Link className="top-icon" href="/settings" title="Settings">
              <SettingsIcon size={16} />
            </Link>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
