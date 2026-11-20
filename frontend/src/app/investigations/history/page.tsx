import { InvestigationHistoryList } from "@/components/investigation-history-list";
import { PageHeading, WorkspaceShell } from "@/components/workspace-shell";

export default function HistoryPage(){return <WorkspaceShell active="Investigation history"><div className="page-content"><PageHeading eyebrow="INVESTIGATIONS" title="Investigation history" description="Search saved investigations and review their processing status."/><InvestigationHistoryList/></div></WorkspaceShell>;}
