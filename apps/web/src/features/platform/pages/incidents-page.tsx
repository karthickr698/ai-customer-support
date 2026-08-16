import { useState } from 'react';
import type { ObservabilityIncidentListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { platformApi } from '../api';
import { hasPlatformPermission } from '../permissions';
import { usePlatformOperator } from '../platform-context';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
];

export function PlatformIncidentsPage() {
  const operator = usePlatformOperator();
  const canManage = hasPlatformPermission(operator, 'platform.observability.manage');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const incidents = useApiQuery<ObservabilityIncidentListResponse>({
    queryKey: queryKeys.platform.incidents({ page, status }),
    path: '/api/observability/failures',
    params: { page, pageSize: 20, status },
  });
  const acknowledge = useApiMutation({
    mutationFn: (incidentId: string) => platformApi.acknowledgeIncident(incidentId),
    invalidateKeys: [queryKeys.platform.incidents()],
    successMessage: 'Incident acknowledged',
  });
  const resolve = useApiMutation({
    mutationFn: (incidentId: string) => platformApi.resolveIncident(incidentId),
    invalidateKeys: [queryKeys.platform.incidents()],
    successMessage: 'Incident resolved',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Incidents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
          searchable={false}
          value={status}
        />
        {incidents.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : incidents.isError ? (
          <QueryErrorAlert
            message={incidents.error.message}
            onRetry={() => {
              void incidents.refetch();
            }}
            requestId={incidents.error.requestId}
            title="Unable to load incidents"
          />
        ) : (incidents.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No incidents" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Count</TableHead>
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
                    <TableCell>{incident.source}</TableCell>
                    <TableCell>
                      <Badge variant={incident.severity === 'critical' || incident.severity === 'high' ? 'destructive' : 'warning'}>
                        {incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{incident.status}</TableCell>
                    <TableCell>{String(incident.count)}</TableCell>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
