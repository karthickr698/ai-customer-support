import { NavLink } from 'react-router-dom';
import {
  Bot,
  BookOpen,
  Inbox,
  Mail,
  MessageCircle,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasPermission } from '../permissions';
import { useWorkspace } from '../workspace-context';
import { workspacePath } from '../workspace-paths';

type WorkspaceNavProps = {
  readonly onNavigate?: () => void;
};

export function WorkspaceNav({ onNavigate }: WorkspaceNavProps) {
  const { organizationId, permissions } = useWorkspace();

  const items = [
    {
      to: workspacePath(organizationId, 'inbox'),
      label: 'Inbox',
      icon: Inbox,
      visible: hasPermission(permissions, 'conversation.read'),
      end: false,
    },
    { to: workspacePath(organizationId, 'members'), label: 'Members', icon: Users, visible: true, end: true },
    {
      to: workspacePath(organizationId, 'invitations'),
      label: 'Invitations',
      icon: Mail,
      visible: hasPermission(permissions, 'organization.invitations.manage'),
      end: true,
    },
    { to: workspacePath(organizationId, 'roles'), label: 'Roles & permissions', icon: Shield, visible: true, end: true },
    { to: workspacePath(organizationId, 'knowledge'), label: 'Knowledge', icon: BookOpen, visible: true, end: false },
    { to: workspacePath(organizationId, 'onboarding'), label: 'AI setup', icon: Sparkles, visible: true, end: true },
    { to: workspacePath(organizationId, 'ai-agent'), label: 'AI agent', icon: Bot, visible: true, end: true },
    { to: workspacePath(organizationId, 'widget'), label: 'Chat widget', icon: MessageCircle, visible: true, end: true },
    {
      to: workspacePath(organizationId, 'audit'),
      label: 'Audit log',
      icon: ScrollText,
      visible: hasPermission(permissions, 'organization.audit.view'),
      end: true,
    },
    { to: workspacePath(organizationId, 'settings'), label: 'Settings', icon: Settings, visible: true, end: true },
  ] as const;

  return (
    <nav className="flex flex-col gap-1 px-2" aria-label="Workspace">
      {items
        .filter((item) => item.visible)
        .map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                )
              }
              end={item.end}
              key={item.to}
              onClick={onNavigate}
              to={item.to}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
    </nav>
  );
}
