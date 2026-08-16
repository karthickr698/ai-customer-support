/* eslint-disable react-refresh/only-export-components -- context hook is the public API */
import { createContext, useContext, type ReactNode } from 'react';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useWorkspaceRealtime, type WorkspaceRealtime } from './use-workspace-realtime';

const RealtimeContext = createContext<WorkspaceRealtime | null>(null);

export function WorkspaceRealtimeProvider({ children }: { readonly children: ReactNode }) {
  const { organizationId, permissions } = useWorkspace();
  const realtime = useWorkspaceRealtime(
    organizationId,
    hasPermission(permissions, 'conversation.read'),
  );

  return <RealtimeContext.Provider value={realtime}>{children}</RealtimeContext.Provider>;
}

export function useInboxRealtime(): WorkspaceRealtime {
  const value = useContext(RealtimeContext);
  if (!value) {
    throw new Error('useInboxRealtime must be used inside the workspace realtime provider');
  }

  return value;
}
