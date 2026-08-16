import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CustomerListResponse } from '@ai-customer-support/contracts';
import { Plus, Search, Users } from 'lucide-react';
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
import { RegisterCustomerDialog } from '@/features/integrations/components/register-dialogs';
import { COMMERCE_PAGE_SIZE, customerStatusLabel, customerStatusVariant } from '@/features/integrations/labels';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function IntegrationCustomersPage() {
  const { permissions } = useWorkspace();
  if (!hasPermission(permissions, 'customer.read')) {
    return (
      <Alert variant="warning">
        <AlertTitle>Customers are limited</AlertTitle>
        <AlertDescription>You need customer.read to view tenant-scoped customer records.</AlertDescription>
      </Alert>
    );
  }
  return <CustomersWorkspace />;
}

function CustomersWorkspace() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'customer.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [registerOpen, setRegisterOpen] = useState(false);
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const filters = useMemo(
    () => ({ page, pageSize: COMMERCE_PAGE_SIZE, q: q.trim() || undefined }),
    [page, q],
  );

  const customers = useApiQuery<CustomerListResponse>({
    queryKey: queryKeys.customers.list(organizationId, filters),
    path: `/api/organizations/${organizationId}/customers`,
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

  const items = customers.data?.items ?? [];
  const total = customers.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / COMMERCE_PAGE_SIZE));

  return (
    <>
      <PageHeader
        actions={
          canManage ? (
            <Button onClick={() => setRegisterOpen(true)} type="button">
              <Plus />
              Register customer
            </Button>
          ) : null
        }
        description="Tenant-scoped customers used by support lookup tools. Connection health and connector permissions sit above the records."
        title="Customers"
      />
      <ConnectorCoverage dataset="customers" />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              aria-label="Search customers"
              className="pl-8"
              onChange={(event) => {
                updateParams({ q: event.target.value || undefined });
              }}
              placeholder="Search name or email"
              value={q}
            />
          </div>
          {customers.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : customers.isError ? (
            <QueryErrorAlert
              message={customers.error.message}
              onRetry={() => {
                void customers.refetch();
              }}
              pending={customers.isFetching}
              title="Unable to load customers"
            />
          ) : items.length === 0 ? (
            <EmptyState
              action={
                canManage ? (
                  <Button onClick={() => setRegisterOpen(true)} type="button">
                    Register a customer
                  </Button>
                ) : undefined
              }
              description="Connect a commerce provider or register a customer so agents can look up profiles."
              icon={<Users className="size-8" />}
              title="No customers match"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>External id</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                        {customer.phone ? (
                          <p className="text-xs text-muted-foreground">{customer.phone}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={customerStatusVariant(customer.status)}>
                          {customerStatusLabel(customer.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{customer.externalCustomerId ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(customer.updatedAt)}</TableCell>
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
      <RegisterCustomerDialog onOpenChange={setRegisterOpen} open={registerOpen} organizationId={organizationId} />
    </>
  );
}
