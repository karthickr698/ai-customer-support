import { useState } from 'react';
import type { ObservabilityIncidentListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { observabilityApi } from '../api';

export function ObservabilityIncidentsPage() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'observability.manage');
  const [page, setPage] = useState(1);

  const incidents = useApiQuery<ObservabilityIncidentListResponse>({
    queryKey: queryKeys.observability.incidents(organizationId, { page }),
    path: `/api/organizations/${organizationId}/observability/failures`,
    params: { page, pageSize: 20 },
  });
  const acknowledge = useApiMutation({
    mutationFn: (incidentId: string) => observabilityApi.acknowledgeIncident(organizationId, incidentId),
    invalidateKeys: [queryKeys.observability.incidents(organizationId)],
    successMessage: 'Incident acknowledged',
  });
  const resolve = useApiMutation({
    mutationFn: (incidentId: string) => observabilityApi.resolveIncident(organizationId, incidentId),
    invalidateKeys: [queryKeys.observability.incidents(organizationId)],
    successMessage: 'Incident resolved',
  });

  if (incidents.isPending) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (incidents.isError) {
    return (
      <QueryErrorAlert
        message={incidents.error.message}
        onRetry={() => {
          void incidents.refetch();
        }}
        requestId={incidents.error.requestId}
        title="Unable to load incidents"
      />
    );
  }
  if ((incidents.data?.items.length ?? 0) === 0) {
    return <EmptyState description="HTTP, AI, and evaluation failures will appear here." title="No incidents" />;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(incidents.data?.items ?? []).map((incident) => (
            <TableRow key={incident.id}>
              <TableCell>
                <p>{incident.title}</p>
                <p className="text-xs text-muted-foreground">{incident.message}</p>
              </TableCell>
              <TableCell>
                <Badge variant={incident.severity === 'critical' || incident.severity === 'high' ? 'destructive' : 'warning'}>
                  {incident.severity}
                </Badge>
              </TableCell>
              <TableCell>{incident.status}</TableCell>
              <TableCell>{formatDateTime(incident.lastSeenAt)}</TableCell>
              <TableCell className="space-x-2">
                {canManage && incident.status === 'open' ? (
                  <Button onClick={() => acknowledge.mutate(incident.id)} size="sm" type="button" variant="outline">
                    Acknowledge
                  </Button>
                ) : null}
                {canManage && incident.status !== 'resolved' ? (
                  <Button onClick={() => resolve.mutate(incident.id)} size="sm" type="button" variant="outline">
                    Resolve
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
        pageCount={Math.max(1, Math.ceil((incidents.data?.total ?? 0) / 20))}
      />
    </div>
  );
}
