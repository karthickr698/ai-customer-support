import { LogOut } from 'lucide-react';
import type { AgentPresenceStatus } from '@ai-customer-support/contracts';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PresenceDot } from '@/features/conversations/components/presence-dot';
import { PRESENCE_LABELS } from '@/features/conversations/labels';
import { useInboxRealtime } from '@/features/conversations/realtime/realtime-context';
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
  const realtime = useInboxRealtime();

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
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <PresenceDot status={realtime.ownStatus} />
            {user?.displayName}
          </p>
          <div className="mt-1">
            <Select
              disabled={!realtime.connected}
              onValueChange={(value) => {
                if (value === 'online' || value === 'away' || value === 'busy') {
                  realtime.setOwnStatus(value);
                }
              }}
              options={PRESENCE_OPTIONS}
              searchable={false}
              value={realtime.ownStatus === 'offline' ? 'online' : realtime.ownStatus}
            />
          </div>
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

const PRESENCE_OPTIONS: ReadonlyArray<{
  value: Exclude<AgentPresenceStatus, 'offline'>;
  label: string;
}> = [
  { value: 'online', label: PRESENCE_LABELS.online },
  { value: 'away', label: PRESENCE_LABELS.away },
  { value: 'busy', label: PRESENCE_LABELS.busy },
];
