import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Shield, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { ticketsPath } from '../labels';

export function TicketsLayout() {
  return (
    <RequireWorkspacePermission
      description="You need ticket.manage to open the support ticket queue."
      permission="ticket.manage"
      title="Tickets are unavailable"
    >
      <TicketsShell />
    </RequireWorkspacePermission>
  );
}

function TicketsShell() {
  const { organizationId } = useWorkspace();
  const location = useLocation();
  const onPolicies = location.pathname.includes('/tickets/policies');

  const items = [
    { to: ticketsPath(organizationId), label: 'Queue', icon: Ticket, active: !onPolicies },
    { to: ticketsPath(organizationId, 'policies'), label: 'SLA & escalation', icon: Shield, active: onPolicies },
  ];

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] min-h-0 flex-col lg:h-screen">
      <nav aria-label="Ticket sections" className="flex gap-1 border-b border-border bg-background px-4 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground',
                'hover:text-foreground',
                item.active && 'bg-muted text-foreground',
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
