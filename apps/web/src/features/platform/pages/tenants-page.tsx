import { useState, type FormEvent } from 'react';
import type { PlatformTenantListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { formatDateTime } from '@/features/organizations/format';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { platformApi } from '../api';
import { hasPlatformPermission } from '../permissions';
import { usePlatformOperator } from '../platform-context';

export function PlatformTenantsPage() {
  const operator = usePlatformOperator();
  const canManage = hasPlatformPermission(operator, 'platform.tenants.manage');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [pending, setPending] = useState<{ id: string; action: 'suspend' | 'activate' } | undefined>();

  const tenants = useApiQuery<PlatformTenantListResponse>({
    queryKey: queryKeys.platform.tenants({ page, q, status }),
    path: '/api/platform/tenants',
    params: { page, pageSize: 20, q, status },
  });
  const suspend = useApiMutation({
    mutationFn: (organizationId: string) => platformApi.suspendTenant(organizationId),
    invalidateKeys: [queryKeys.platform.tenants()],
    successMessage: 'Tenant suspended',
  });
  const activate = useApiMutation({
    mutationFn: (organizationId: string) => platformApi.activateTenant(organizationId),
    invalidateKeys: [queryKeys.platform.tenants()],
    successMessage: 'Tenant activated',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const next = (event.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim();
            setQ(next);
            setPage(1);
          }}
        >
          <Input className="max-w-xs" defaultValue={q} name="q" placeholder="Search name or slug" />
          <Select
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'disabled', label: 'Disabled' },
            ]}
            searchable={false}
            value={status}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        {tenants.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : tenants.isError ? (
          <QueryErrorAlert
            message={tenants.error.message}
            onRetry={() => {
              void tenants.refetch();
            }}
            requestId={tenants.error.requestId}
            title="Unable to load tenants"
          />
        ) : (tenants.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No tenants" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tenants.data?.items ?? []).map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>{tenant.name}</TableCell>
                    <TableCell className="font-mono text-xs">{tenant.slug}</TableCell>
                    <TableCell>{String(tenant.memberCount)}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.status === 'active' ? 'success' : 'secondary'}>{tenant.status}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(tenant.createdAt)}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <Button
                          onClick={() => {
                            setPending({
                              id: tenant.id,
                              action: tenant.status === 'active' ? 'suspend' : 'activate',
                            });
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              onPageChange={setPage}
              page={page}
              pageCount={Math.max(1, Math.ceil((tenants.data?.total ?? 0) / 20))}
            />
          </>
        )}
      </CardContent>
      <ConfirmDialog
        confirmLabel={pending?.action === 'suspend' ? 'Suspend' : 'Activate'}
        description="This changes tenant access immediately."
        onConfirm={() => {
          if (!pending) {
            return;
          }
          if (pending.action === 'suspend') {
            suspend.mutate(pending.id);
          } else {
            activate.mutate(pending.id);
          }
          setPending(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPending(undefined);
          }
        }}
        open={Boolean(pending)}
        title={pending?.action === 'suspend' ? 'Suspend tenant?' : 'Activate tenant?'}
        variant={pending?.action === 'suspend' ? 'destructive' : 'default'}
      />
    </Card>
  );
}
