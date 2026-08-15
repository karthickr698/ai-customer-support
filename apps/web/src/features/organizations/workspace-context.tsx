/* eslint-disable react-refresh/only-export-components -- context hook is the public API */
import { createContext, useContext, type ReactNode } from 'react';
import type { OrganizationPermission, OrganizationWithMembershipDto } from '@ai-customer-support/contracts';

export type WorkspaceContextValue = {
  readonly organizationId: string;
  readonly organization: OrganizationWithMembershipDto;
  readonly organizations: readonly OrganizationWithMembershipDto[];
  readonly permissions: readonly OrganizationPermission[];
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  readonly value: WorkspaceContextValue;
  readonly children: ReactNode;
}) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error('useWorkspace must be used inside the workspace layout');
  }
  return value;
}
