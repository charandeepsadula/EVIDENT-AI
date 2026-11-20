import { Suspense } from "react";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";
import { InvestigationForm } from "@/components/investigation-form";

export default function NewInvestigationPage() {
  return (
    <WorkspaceShell active="New investigation">
      <div className="page-content narrow-content">
        <PageHeading
          eyebrow="INVESTIGATION STUDIO"
          title="New investigation"
          description="Submit text, a claim, or a public URL to begin. Findings require connected research and AI services."
        />
        <Suspense fallback={<div className="muted-label">Loading form…</div>}>
          <InvestigationForm />
        </Suspense>
      </div>
    </WorkspaceShell>
  );
}
