import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ReturnListResponse } from '@ai-customer-support/contracts';
import { Plus, RotateCcw, Search } from 'lucide-react';
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
import { RegisterReturnDialog } from '@/features/integrations/components/register-dialogs';
import { COMMERCE_PAGE_SIZE, returnStatusLabel, returnStatusVariant } from '@/features/integrations/labels';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function IntegrationReturnsPage() {
  const { permissions } = useWorkspace();
  if (!hasPermission(permissions, 'customer.read')) {
    return (
      <Alert variant="warning">
        <AlertTitle>Returns are limited</AlertTitle>
        <AlertDescription>You need customer.read to view tenant-scoped return records.</AlertDescription>
      </Alert>
    );
  }
  return <ReturnsWorkspace />;
}

function ReturnsWorkspace() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'customer.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [registerOpen, setRegisterOpen] = useState(false);
  const orderId = searchParams.get('orderId') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const filters = useMemo(
    () => ({ page, pageSize: COMMERCE_PAGE_SIZE, orderId: orderId.trim() || undefined }),
    [orderId, page],
  );

  const returns = useApiQuery<ReturnListResponse>({
    queryKey: queryKeys.returns.list(organizationId, filters),
    path: `/api/organizations/${organizationId}/returns`,
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

  const items = returns.data?.items ?? [];
  const total = returns.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / COMMERCE_PAGE_SIZE));

  return (
    <>
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => setRegisterOpen(true)} type="button">
              <Plus />
              Register return
            </Button>
          ) : null
        }
        description="Return records used by refund-status tools. Connector health and granted refund scopes are shown above."
        title="Returns"
      />
      <ConnectorCoverage dataset="returns" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              aria-label="Filter by order id"
              className="pl-8"
              onChange={(event) => {
                updateParams({ orderId: event.target.value || undefined });
              }}
              placeholder="Order UUID"
              value={orderId}
            />
          </div>
          {returns.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : returns.isError ? (
            <QueryErrorAlert
              message={returns.error.message}
              onRetry={() => {
                void returns.refetch();
              }}
              pending={returns.isFetching}
              title="Unable to load returns"
            />
          ) : items.length === 0 ? (
            <EmptyState
              action={
                canManage ? (
                  <Button onClick={() => setRegisterOpen(true)} type="button">
                    Register a return
                  </Button>
                ) : undefined
              }
              description="Connect a payments or commerce connector, or register a return, so agents can check refund status."
              icon={<RotateCcw className="size-8" />}
              title="No returns match"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <p className="font-mono text-xs">{record.id}</p>
                        <p className="text-xs text-muted-foreground">Order {record.orderId}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={returnStatusVariant(record.status)}>{returnStatusLabel(record.status)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{record.reason ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(record.requestedAt)}</TableCell>
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
      <RegisterReturnDialog onOpenChange={setRegisterOpen} open={registerOpen} organizationId={organizationId} />
    </>
  );
}
