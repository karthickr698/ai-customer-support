import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Box, Package, RotateCcw, Store, Truck, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { integrationsPath } from '../labels';

export function IntegrationsLayout() {
  const { organizationId, permissions } = useWorkspace();
  const location = useLocation();
  const canManage = hasPermission(permissions, 'integration.manage');
  const canRead = hasPermission(permissions, 'customer.read');
  const pathname = location.pathname;

  if (!canManage && !canRead) {
    return (
      <WorkspacePage>
        <Alert variant="warning">
          <AlertTitle>Integrations are limited</AlertTitle>
          <AlertDescription>
            You need customer.read to view commerce records, or integration.manage to connect providers.
          </AlertDescription>
        </Alert>
      </WorkspacePage>
    );
  }

  const items = [
    ...(canManage
      ? [
          {
            to: integrationsPath(organizationId),
            label: 'Marketplace',
            icon: Store,
            active: pathname.endsWith('/integrations') || pathname.endsWith('/integrations/'),
          },
        ]
      : []),
    ...(canRead
      ? [
          {
            to: integrationsPath(organizationId, 'customers'),
            label: 'Customers',
            icon: Users,
            active: pathname.includes('/integrations/customers'),
          },
          {
            to: integrationsPath(organizationId, 'products'),
            label: 'Products',
            icon: Package,
            active: pathname.includes('/integrations/products'),
          },
          {
            to: integrationsPath(organizationId, 'orders'),
            label: 'Orders',
            icon: Box,
            active: pathname.includes('/integrations/orders'),
          },
          {
            to: integrationsPath(organizationId, 'returns'),
            label: 'Returns',
            icon: RotateCcw,
            active: pathname.includes('/integrations/returns'),
          },
          {
            to: integrationsPath(organizationId, 'shipping'),
            label: 'Shipping',
            icon: Truck,
            active: pathname.includes('/integrations/shipping'),
          },
        ]
      : []),
  ];

  return (
    <WorkspacePage wide>
      <nav aria-label="Integration sections" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
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
