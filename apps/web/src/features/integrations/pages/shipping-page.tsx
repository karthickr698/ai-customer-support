import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ShipmentListResponse } from '@ai-customer-support/contracts';
import { Plus, Search, Truck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConnectorCoverage } from '@/features/integrations/components/connector-coverage';
import { QueryErrorAlert } from '@/features/integrations/components/query-error';
import { RegisterShipmentDialog } from '@/features/integrations/components/register-dialogs';
import { COMMERCE_PAGE_SIZE, shipmentStatusLabel, shipmentStatusVariant } from '@/features/integrations/labels';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function IntegrationShippingPage() {
  const { permissions } = useWorkspace();
  if (!hasPermission(permissions, 'customer.read')) {
    return (
      <Alert variant="warning">
        <AlertTitle>Shipping is limited</AlertTitle>
        <AlertDescription>You need customer.read to view tenant-scoped shipment records.</AlertDescription>
      </Alert>
    );
  }
  return <ShippingWorkspace />;
}

function ShippingWorkspace() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'customer.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [registerOpen, setRegisterOpen] = useState(false);
  const trackingNumber = searchParams.get('trackingNumber') ?? '';
  const orderId = searchParams.get('orderId') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const filters = useMemo(
    () => ({
      page,
      pageSize: COMMERCE_PAGE_SIZE,
      trackingNumber: trackingNumber.trim() || undefined,
      orderId: orderId.trim() || undefined,
    }),
    [orderId, page, trackingNumber],
  );

  const shipments = useApiQuery<ShipmentListResponse>({
    queryKey: queryKeys.shipments.list(organizationId, filters),
    path: `/api/organizations/${organizationId}/shipments`,
    params: filters,
  });

  function updateParams(next: Record<string, string | undefined>): void {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    if (!('page' in next)) {
      params.delete('page');
    }
    setSearchParams(params);
  }

  const items = shipments.data?.items ?? [];
  const total = shipments.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / COMMERCE_PAGE_SIZE));

  return (
    <>
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => setRegisterOpen(true)} type="button">
              <Plus />
              Register shipment
            </Button>
          ) : null
        }
        description="Shipment records used by tracking lookup. Fulfillment connector health and permissions are shown above."
        title="Shipping"
      />
      <ConnectorCoverage dataset="shipping" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Filter by tracking number"
                className="pl-8"
                onChange={(event) => {
                  updateParams({ trackingNumber: event.target.value || undefined });
                }}
                placeholder="Tracking number"
                value={trackingNumber}
              />
            </div>
            <Input
              aria-label="Filter by order id"
              onChange={(event) => {
                updateParams({ orderId: event.target.value || undefined });
              }}
              placeholder="Order UUID"
              value={orderId}
            />
          </div>
          {shipments.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : shipments.isError ? (
            <QueryErrorAlert
              message={shipments.error.message}
              onRetry={() => {
                void shipments.refetch();
              }}
              pending={shipments.isFetching}
              title="Unable to load shipments"
            />
          ) : items.length === 0 ? (
            <EmptyState
              action={
                canManage ? (
                  <Button onClick={() => setRegisterOpen(true)} type="button">
                    Register a shipment
                  </Button>
                ) : undefined
              }
              description="Connect a commerce connector or register a shipment so agents can look up tracking."
              icon={<Truck className="size-8" />}
              title="No shipments match"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Shipped</TableHead>
                    <TableHead>ETA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell>
                        <p className="font-mono text-sm">{shipment.trackingNumber}</p>
                        <p className="text-xs text-muted-foreground">Order {shipment.orderId}</p>
                      </TableCell>
                      <TableCell>{shipment.carrier}</TableCell>
                      <TableCell>
                        <Badge variant={shipmentStatusVariant(shipment.status)}>
                          {shipmentStatusLabel(shipment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {shipment.shippedAt ? formatDateTime(shipment.shippedAt) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {shipment.estimatedDeliveryAt ? formatDateTime(shipment.estimatedDeliveryAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                onPageChange={(next) => {
                  updateParams({ page: String(next) });
                }}
                page={page}
                pageCount={pageCount}
              />
            </>
          )}
        </CardContent>
      </Card>
      <RegisterShipmentDialog onOpenChange={setRegisterOpen} open={registerOpen} organizationId={organizationId} />
    </>
  );
}
