import type { ReactNode } from 'react';
import type { OrganizationPermission } from '@ai-customer-support/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { hasPermission } from '../permissions';
import { useWorkspace } from '../workspace-context';
import { WorkspacePage } from '../components/workspace-page';

export function RequireWorkspacePermission({
  permission,
  title,
  description,
  children,
}: {
  readonly permission: OrganizationPermission;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  const { permissions } = useWorkspace();

  if (!hasPermission(permissions, permission)) {
    return (
      <WorkspacePage>
        <Alert variant="warning">
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{description}</AlertDescription>
        </Alert>
      </WorkspacePage>
    );
  }

  return children;
}
