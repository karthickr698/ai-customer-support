import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { OrderDto, OrderListResponse } from '@ai-customer-support/contracts';
import { Box, Plus, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConnectorCoverage } from '@/features/integrations/components/connector-coverage';
import { QueryErrorAlert } from '@/features/integrations/components/query-error';
import { RegisterOrderDialog } from '@/features/integrations/components/register-dialogs';
import {
  COMMERCE_PAGE_SIZE,
  formatMoney,
  orderStatusLabel,
  orderStatusVariant,
} from '@/features/integrations/labels';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function IntegrationOrdersPage() {
  const { permissions } = useWorkspace();
  if (!hasPermission(permissions, 'customer.read')) {
    return (
      <Alert variant="warning">
        <AlertTitle>Orders are limited</AlertTitle>
        <AlertDescription>You need customer.read to view tenant-scoped order records.</AlertDescription>
      </Alert>
    );
  }
  return <OrdersWorkspace />;
}

function OrdersWorkspace() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'customer.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selected, setSelected] = useState<OrderDto>();
  const externalOrderId = searchParams.get('externalOrderId') ?? '';
  const customerId = searchParams.get('customerId') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const filters = useMemo(
    () => ({
      page,
      pageSize: COMMERCE_PAGE_SIZE,
      externalOrderId: externalOrderId.trim() || undefined,
      customerId: customerId.trim() || undefined,
    }),
    [customerId, externalOrderId, page],
  );

  const orders = useApiQuery<OrderListResponse>({
    queryKey: queryKeys.orders.list(organizationId, filters),
    path: `/api/organizations/${organizationId}/orders`,
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

  const items = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / COMMERCE_PAGE_SIZE));

  return (
    <>
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => setRegisterOpen(true)} type="button">
              <Plus />
              Register order
            </Button>
          ) : null
        }
        description="Orders used by support lookup and refund tools. Connector status and granted scopes are shown above."
        title="Orders"
      />
      <ConnectorCoverage dataset="orders" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Filter by external order id"
                className="pl-8"
                onChange={(event) => {
                  updateParams({ externalOrderId: event.target.value || undefined });
                }}
                placeholder="External order id"
                value={externalOrderId}
              />
            </div>
            <Input
              aria-label="Filter by customer id"
              onChange={(event) => {
                updateParams({ customerId: event.target.value || undefined });
              }}
              placeholder="Customer UUID"
              value={customerId}
            />
          </div>
          {orders.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : orders.isError ? (
            <QueryErrorAlert
              message={orders.error.message}
              onRetry={() => {
                void orders.refetch();
              }}
              pending={orders.isFetching}
              title="Unable to load orders"
            />
          ) : items.length === 0 ? (
            <EmptyState
              action={
                canManage ? (
                  <Button onClick={() => setRegisterOpen(true)} type="button">
                    Register an order
                  </Button>
                ) : undefined
              }
              description="Connect a store or register an order so agents can look up purchase history."
              icon={<Box className="size-8" />}
              title="No orders match"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Placed</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <p className="font-mono text-sm">{order.externalOrderId}</p>
                        <p className="text-xs text-muted-foreground">{order.lineItems.length} line items</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={orderStatusVariant(order.status)}>{orderStatusLabel(order.status)}</Badge>
                      </TableCell>
                      <TableCell>{formatMoney(order.totalAmount, order.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(order.placedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => {
                            setSelected(order);
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Details
                        </Button>
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
      <RegisterOrderDialog onOpenChange={setRegisterOpen} open={registerOpen} organizationId={organizationId} />
      {selected ? (
        <Dialog
          onOpenChange={(open) => {
            if (!open) {
              setSelected(undefined);
            }
          }}
          open
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected.externalOrderId}</DialogTitle>
              <DialogDescription>
                {orderStatusLabel(selected.status)} · {formatMoney(selected.totalAmount, selected.currency)}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Customer id</dt>
                <dd className="mt-1 break-all font-mono text-xs">{selected.customerId}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Placed</dt>
                <dd className="mt-1">{formatDateTime(selected.placedAt)}</dd>
              </div>
            </dl>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.lineItems.map((line) => (
                  <TableRow key={`${line.sku}-${line.name}`}>
                    <TableCell>
                      <p className="font-medium">{line.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                    </TableCell>
                    <TableCell>{line.quantity}</TableCell>
                    <TableCell>{formatMoney(line.unitAmount, selected.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
