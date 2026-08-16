import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, FileText, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { knowledgePath } from '../labels';

export function KnowledgeLayout() {
  const { organizationId, permissions } = useWorkspace();
  const location = useLocation();
  const onSources = location.pathname.includes('/knowledge/sources');
  const onPlayground = location.pathname.includes('/knowledge/playground');
  const canManage = hasPermission(permissions, 'knowledge.manage');

  const items = [
    { to: knowledgePath(organizationId), label: 'Articles', icon: FileText, active: !onSources && !onPlayground },
    { to: knowledgePath(organizationId, 'sources'), label: 'Sources', icon: BookOpen, active: onSources },
    ...(canManage
      ? [
          {
            to: knowledgePath(organizationId, 'playground'),
            label: 'Playground',
            icon: FlaskConical,
            active: onPlayground,
          },
        ]
      : []),
  ];

  return (
    <WorkspacePage wide>
      <nav aria-label="Knowledge sections" className="flex gap-1 rounded-lg bg-muted p-1">
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
