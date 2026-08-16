import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bot, FileText, GitBranch, HeartPulse } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { observabilityPath } from '../api';

export function ObservabilityLayout() {
  return (
    <RequireWorkspacePermission
      description="You need observability.view to open logs, traces, and incidents."
      permission="observability.view"
      title="Observability is unavailable"
    >
      <ObservabilityShell />
    </RequireWorkspacePermission>
  );
}

function ObservabilityShell() {
  const { organizationId } = useWorkspace();
  const items = [
    { to: observabilityPath(organizationId), label: 'Overview', icon: HeartPulse, end: true },
    { to: observabilityPath(organizationId, 'logs'), label: 'Logs', icon: FileText, end: true },
    { to: observabilityPath(organizationId, 'traces'), label: 'Traces', icon: GitBranch, end: true },
    { to: observabilityPath(organizationId, 'incidents'), label: 'Incidents', icon: Activity, end: true },
    { to: observabilityPath(organizationId, 'evaluations'), label: 'AI evaluations', icon: Bot, end: true },
  ];

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Tenant-scoped logs, traces, failure incidents, and AI evaluations. Retry and request IDs are shown on every error."
        title="Observability"
      />
      <nav aria-label="Observability sections" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground',
                  isActive && 'bg-background text-foreground shadow-sm',
                )
              }
              end={item.end}
              key={item.to}
              to={item.to}
            >
              <Icon className="size-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </WorkspacePage>
  );
}
