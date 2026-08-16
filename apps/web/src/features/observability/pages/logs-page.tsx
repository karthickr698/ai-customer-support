import { useState, type FormEvent } from 'react';
import type { ObservabilityLogListResponse } from '@ai-customer-support/contracts';
import { OBSERVABILITY_LOG_LEVELS } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function ObservabilityLogsPage() {
  const { organizationId } = useWorkspace();
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState('');
  const [route, setRoute] = useState('');

  const logs = useApiQuery<ObservabilityLogListResponse>({
    queryKey: queryKeys.observability.logs(organizationId, { page, level, route }),
    path: `/api/organizations/${organizationId}/observability/logs`,
    params: { page, pageSize: 20, level, route },
  });

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          setRoute((event.currentTarget.elements.namedItem('route') as HTMLInputElement).value.trim());
          setPage(1);
        }}
      >
        <Input className="max-w-sm" name="route" placeholder="Filter by route" />
        <Select
          onValueChange={(value) => {
            setLevel(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All levels' },
            ...OBSERVABILITY_LOG_LEVELS.map((item) => ({ value: item, label: item })),
          ]}
          searchable={false}
          value={level}
        />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>
      {logs.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : logs.isError ? (
        <QueryErrorAlert
          message={logs.error.message}
          onRetry={() => {
            void logs.refetch();
          }}
          requestId={logs.error.requestId}
          title="Unable to load logs"
        />
      ) : (logs.data?.items.length ?? 0) === 0 ? (
        <EmptyState description="Matching structured logs will appear here." title="No logs" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Request</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs.data?.items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(item.occurredAt)}</TableCell>
                  <TableCell>
                    <Badge variant={item.level === 'error' ? 'destructive' : item.level === 'warn' ? 'warning' : 'secondary'}>
                      {item.level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p>{item.message}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.method} {item.path}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.requestId ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            onPageChange={setPage}
            page={page}
            pageCount={Math.max(1, Math.ceil((logs.data?.total ?? 0) / 20))}
          />
        </>
      )}
    </div>
  );
}
