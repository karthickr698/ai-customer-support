import { Navigate } from 'react-router-dom';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { IntegrationsMarketplacePage } from './marketplace-page';

export function IntegrationsIndexPage() {
  const { permissions } = useWorkspace();
  if (hasPermission(permissions, 'integration.manage')) {
    return <IntegrationsMarketplacePage />;
  }
  if (hasPermission(permissions, 'customer.read')) {
    return <Navigate replace to="customers" />;
  }
  return null;
}
