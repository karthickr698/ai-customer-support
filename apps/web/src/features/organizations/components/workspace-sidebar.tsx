import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/features/identity/auth-store';
import { MemberAvatar } from './member-avatar';
import { OrganizationSwitcher } from './organization-switcher';
import { WorkspaceNav } from './workspace-nav';
import { useWorkspace } from '../workspace-context';

type WorkspaceSidebarProps = {
  readonly onNavigate?: () => void;
  readonly onCreateWorkspace: () => void;
};

export function WorkspaceSidebar({ onNavigate, onCreateWorkspace }: WorkspaceSidebarProps) {
  const { organization, organizations } = useWorkspace();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-3">
        <OrganizationSwitcher
          current={organization}
          onCreateWorkspace={onCreateWorkspace}
          onNavigate={onNavigate}
          organizations={organizations}
        />
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto py-3">
        <WorkspaceNav onNavigate={onNavigate} />
      </div>
      <Separator />
      <div className="flex items-center gap-2 p-3">
        <MemberAvatar className="size-8" email={user?.email} name={user?.displayName ?? 'You'} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <Button
          aria-label="Sign out"
          onClick={() => {
            void logout();
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <LogOut />
        </Button>
      </div>
    </div>
  );
}
