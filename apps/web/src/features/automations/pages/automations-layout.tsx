import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { GitBranch, History } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { automationsPath } from '../labels';

export function AutomationsLayout() {
  return (
    <RequireWorkspacePermission
      description="You need automation.read to view workflow rules."
      permission="automation.read"
      title="Workflows are unavailable"
    >
      <AutomationsShell />
    </RequireWorkspacePermission>
  );
}

function AutomationsShell() {
  const { organizationId } = useWorkspace();
  const automationsFlag = useFeatureFlag('automations', organizationId);
  const location = useLocation();
  const onHistory = location.pathname.includes('/history');
  const onBuilder =
    location.pathname.includes('/automations/new') ||
    (!onHistory && /\/automations\/[0-9a-f-]{8,}$/i.test(location.pathname));

  const items = [
    { to: automationsPath(organizationId), label: 'Rules', icon: GitBranch, active: !onHistory && !onBuilder },
    { to: automationsPath(organizationId, 'history'), label: 'Execution history', icon: History, active: onHistory },
  ];

  if (!automationsFlag.enabled) {
    return (
      <WorkspacePage>
        <EmptyState
          description="A platform feature flag turned this product area off for the tenant."
          title="Workflows are disabled"
        />
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Event and schedule triggers, conditions, and actions. Test a rule with a payload; jobs and logs show every attempt."
        title="Workflows"
      />
      {!onBuilder ? (
        <nav aria-label="Workflow sections" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground',
                  'hover:text-foreground',
                  item.active && 'bg-background text-foreground shadow-sm',
                )}
                key={item.to}
                to={item.to}
              >
                <Icon className="size-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      ) : null}
      <Outlet />
    </WorkspacePage>
  );
}
