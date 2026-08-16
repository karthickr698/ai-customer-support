import { useState } from 'react';
import type { PlatformAuditLogListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function PlatformAuditPage() {
  const [page, setPage] = useState(1);
  const audit = useApiQuery<PlatformAuditLogListResponse>({
    queryKey: queryKeys.platform.audit({ page }),
    path: '/api/platform/audit-logs',
    params: { page, pageSize: 20 },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform audit</CardTitle>
        <CardDescription>Operator grants, tenant suspend/activate, and feature-flag changes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {audit.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : audit.isError ? (
          <QueryErrorAlert
            message={audit.error.message}
            onRetry={() => {
              void audit.refetch();
            }}
            requestId={audit.error.requestId}
            title="Unable to load audit activity"
          />
        ) : (audit.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No audit events" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(audit.data?.items ?? []).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs">{event.action}</TableCell>
                    <TableCell>
                      {event.resourceType}
                      {event.resourceId ? ` · ${event.resourceId}` : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.outcome === 'success' ? 'success' : 'destructive'}>{event.outcome}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(event.occurredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              onPageChange={setPage}
              page={page}
              pageCount={Math.max(1, Math.ceil((audit.data?.total ?? 0) / 20))}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
