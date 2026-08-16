import type { PlatformHealthResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function PlatformHealthPage() {
  const health = useApiQuery<PlatformHealthResponse>({
    queryKey: queryKeys.platform.health(),
    path: '/api/platform/health',
    validateStatus: (status) => status === 200 || status === 503,
  });

  if (health.isPending) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (health.isError) {
    return (
      <QueryErrorAlert
        message={health.error.message}
        onRetry={() => {
          void health.refetch();
        }}
        requestId={health.error.requestId}
        title="Unable to load system health"
      />
    );
  }

  const data = health.data;
  const variant = data.status === 'ok' ? 'success' : data.status === 'degraded' ? 'warning' : 'destructive';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          System health
          <Badge variant={variant}>{data.status}</Badge>
        </CardTitle>
        <CardDescription>Checked {formatDateTime(data.checkedAt)}.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.checks.map((check) => (
              <TableRow key={check.name}>
                <TableCell>{check.name}</TableCell>
                <TableCell>
                  <Badge variant={check.status === 'up' ? 'success' : 'destructive'}>{check.status}</Badge>
                </TableCell>
                <TableCell>{String(check.latencyMs)}ms</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
