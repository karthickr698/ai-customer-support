import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { FlaskConical, KeyRound, Plug, ScrollText, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { toolsPath } from '../labels';

export function ToolsLayout() {
  const { organizationId, permissions } = useWorkspace();
  const location = useLocation();
  const canManage = hasPermission(permissions, 'integration.manage');
  const canAudit =
    hasPermission(permissions, 'organization.audit.view') || hasPermission(permissions, 'integration.manage');

  const pathname = location.pathname;
  const items = [
    {
      to: toolsPath(organizationId),
      label: 'Catalog',
      icon: Wrench,
      active: pathname.endsWith('/tools') || pathname.endsWith('/tools/'),
    },
    ...(canManage
      ? [
          {
            to: toolsPath(organizationId, 'credentials'),
            label: 'Credentials',
            icon: KeyRound,
            active: pathname.includes('/tools/credentials'),
          },
          {
            to: toolsPath(organizationId, 'oauth'),
            label: 'OAuth',
            icon: Plug,
            active: pathname.includes('/tools/oauth'),
          },
        ]
      : []),
    {
      to: toolsPath(organizationId, 'test'),
      label: 'Test',
      icon: FlaskConical,
      active: pathname.includes('/tools/test'),
    },
    ...(canAudit
      ? [
          {
            to: toolsPath(organizationId, 'invocations'),
            label: 'Invocations',
            icon: ScrollText,
            active: pathname.includes('/tools/invocations'),
          },
        ]
      : []),
  ];

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Allowlisted tools, encrypted connector credentials, argument schemas, and audited test calls. TypeScript authorizes every execution; secrets never leave the API in plaintext."
        title="Tools"
      />
      <nav aria-label="Tool sections" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground',
                'hover:text-foreground',
                item.active && 'bg-background text-foreground shadow-sm',
              )}
              end={false}
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
