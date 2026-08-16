import type { ObservabilityOverviewResponse } from '@ai-customer-support/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/features/analytics/components/kpi-card';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

function percent(part: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }
  return `${String(Math.round((part / total) * 1000) / 10)}%`;
}

export function PlatformUsagePage() {
  const overview = useApiQuery<ObservabilityOverviewResponse>({
    queryKey: queryKeys.platform.usage(),
    path: '/api/observability/overview',
  });

  if (overview.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <QueryErrorAlert
        message={overview.error.message}
        onRetry={() => {
          void overview.refetch();
        }}
        requestId={overview.error.requestId}
        title="Unable to load platform usage"
      />
    );
  }

  const data = overview.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard hint={`${percent(data.requests.errors, data.requests.total)} error rate`} title="HTTP requests" value={String(data.requests.total)} />
        <KpiCard hint={`Avg ${String(Math.round(data.requests.averageLatencyMs))}ms`} title="Request errors" tone="danger" value={String(data.requests.errors)} />
        <KpiCard hint={`${String(data.ai.promptTokens + data.ai.completionTokens)} tokens`} title="AI calls" value={String(data.ai.calls)} />
        <KpiCard hint={`${String(data.incidents.acknowledged)} ack · ${String(data.incidents.resolved)} resolved`} title="Open incidents" tone="warning" value={String(data.incidents.open)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Period</CardTitle>
          <CardDescription>
            {data.period.from} → {data.period.to}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Traces {String(data.traces.total)} ({String(data.traces.errors)} errors). AI evaluation failures{' '}
          {String(data.ai.evaluationsFailed)}.
        </CardContent>
      </Card>
    </div>
  );
}
