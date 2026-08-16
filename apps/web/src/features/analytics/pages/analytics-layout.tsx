import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, MessageSquare, Ticket, UserRound, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useFeatureFlag } from '@/hooks/use-feature-flag';
import { AnalyticsFilters, useAnalyticsFilters } from '../components/filters';
import { analyticsPath } from '../labels';

export function AnalyticsLayout() {
  return (
    <RequireWorkspacePermission
      description="You need analytics.view to open support analytics."
      permission="analytics.view"
      title="Analytics are unavailable"
    >
      <AnalyticsShell />
    </RequireWorkspacePermission>
  );
}

function AnalyticsShell() {
  const { organizationId } = useWorkspace();
  const analyticsFlag = useFeatureFlag('analytics', organizationId);
  const location = useLocation();
  const { filters, setRange, setGranularity } = useAnalyticsFilters();
  const search = location.search;

  const items = [
    { to: analyticsPath(organizationId), label: 'Overview', icon: BarChart3, end: true },
    { to: analyticsPath(organizationId, 'conversations'), label: 'Conversations', icon: MessageSquare, end: false },
    { to: analyticsPath(organizationId, 'tickets'), label: 'Tickets', icon: Ticket, end: false },
    { to: analyticsPath(organizationId, 'agents'), label: 'Agents', icon: UserRound, end: false },
    { to: analyticsPath(organizationId, 'customers'), label: 'Customers', icon: Users, end: false },
  ];

  if (!analyticsFlag.enabled) {
    return (
      <WorkspacePage>
        <EmptyState
          description="A platform feature flag turned this product area off for the tenant."
          title="Analytics is disabled"
        />
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage wide>
      <PageHeader
        actions={
          <AnalyticsFilters
            granularity={filters.granularity}
            onGranularityChange={setGranularity}
            onRangeChange={setRange}
            range={filters.range}
          />
        }
        description="Executive KPIs, time series, and drilldowns from tenant-scoped analytics aggregations. CSAT uses ticket resolution rate because survey scores are not in the analytics contract."
        title="Support analytics"
      />
      <nav aria-label="Analytics reports" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground',
                  'hover:text-foreground',
                  isActive && 'bg-background text-foreground shadow-sm',
                )
              }
              end={item.end}
              key={item.to}
              to={`${item.to}${search}`}
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
