import { useState } from 'react';
import type { ObservabilityAiEvaluationListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function ObservabilityEvaluationsPage() {
  const { organizationId } = useWorkspace();
  const [page, setPage] = useState(1);
  const evaluations = useApiQuery<ObservabilityAiEvaluationListResponse>({
    queryKey: queryKeys.observability.evaluations(organizationId, { page }),
    path: `/api/organizations/${organizationId}/observability/ai-evaluations`,
    params: { page, pageSize: 20 },
  });

  if (evaluations.isPending) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (evaluations.isError) {
    return (
      <QueryErrorAlert
        message={evaluations.error.message}
        onRetry={() => {
          void evaluations.refetch();
        }}
        requestId={evaluations.error.requestId}
        title="Unable to load AI evaluations"
      />
    );
  }
  if ((evaluations.data?.items.length ?? 0) === 0) {
    return <EmptyState title="No AI evaluations" />;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Operation</TableHead>
            <TableHead>Verdict</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Latency</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(evaluations.data?.items ?? []).map((item) => (
            <TableRow key={item.id}>
              <TableCell>{formatDateTime(item.occurredAt)}</TableCell>
              <TableCell>
                <p>{item.operation}</p>
                <p className="text-xs text-muted-foreground">{item.reason ?? item.model ?? ''}</p>
              </TableCell>
              <TableCell>
                <Badge variant={item.verdict === 'failed' ? 'destructive' : item.verdict === 'degraded' ? 'warning' : 'success'}>
                  {item.verdict}
                </Badge>
              </TableCell>
              <TableCell>{String(item.score)}</TableCell>
              <TableCell>{String(item.latencyMs)}ms</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        onPageChange={setPage}
        page={page}
        pageCount={Math.max(1, Math.ceil((evaluations.data?.total ?? 0) / 20))}
      />
    </div>
  );
}
