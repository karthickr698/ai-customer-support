import { useState } from 'react';
import type { ObservabilityTraceDetailResponse, ObservabilityTraceListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function ObservabilityTracesPage() {
  const { organizationId } = useWorkspace();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | undefined>();

  const traces = useApiQuery<ObservabilityTraceListResponse>({
    queryKey: queryKeys.observability.traces(organizationId, { page }),
    path: `/api/organizations/${organizationId}/observability/traces`,
    params: { page, pageSize: 20 },
  });
  const detail = useApiQuery<ObservabilityTraceDetailResponse>({
    queryKey: [...queryKeys.observability.traces(organizationId), selected],
    path: `/api/organizations/${organizationId}/observability/traces/${selected ?? ''}`,
    enabled: Boolean(selected),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {traces.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : traces.isError ? (
          <QueryErrorAlert
            message={traces.error.message}
            onRetry={() => {
              void traces.refetch();
            }}
            requestId={traces.error.requestId}
            title="Unable to load traces"
          />
        ) : (traces.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No traces" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(traces.data?.items ?? []).map((trace) => (
                  <TableRow
                    className="cursor-pointer"
                    key={trace.id}
                    onClick={() => {
                      setSelected(trace.id);
                    }}
                  >
                    <TableCell>
                      <p>{trace.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{trace.id}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={trace.status === 'error' ? 'destructive' : 'success'}>{trace.status}</Badge>
                    </TableCell>
                    <TableCell>{String(trace.durationMs)}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              onPageChange={setPage}
              page={page}
              pageCount={Math.max(1, Math.ceil((traces.data?.total ?? 0) / 20))}
            />
          </>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Trace detail</CardTitle>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <EmptyState title="Select a trace" />
          ) : detail.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : detail.isError ? (
            <QueryErrorAlert
              message={detail.error.message}
              onRetry={() => {
                void detail.refetch();
              }}
              requestId={detail.error.requestId}
              title="Unable to load trace"
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {(detail.data?.spans ?? []).map((span) => (
                <li className="rounded-md border border-border p-2" key={span.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span>{span.name}</span>
                    <Badge variant={span.status === 'error' ? 'destructive' : 'secondary'}>{span.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {span.service} · {String(span.durationMs)}ms · {formatDateTime(span.startedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
