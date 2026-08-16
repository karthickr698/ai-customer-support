import type { ObservabilityMetricsResponse, ObservabilityOverviewResponse } from '@ai-customer-support/contracts';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/features/analytics/components/kpi-card';
import { Sparkline } from '@/features/analytics/components/charts';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';

export function ObservabilityOverviewPage() {
  const { organizationId } = useWorkspace();
  const overview = useApiQuery<ObservabilityOverviewResponse>({
    queryKey: queryKeys.observability.overview(organizationId),
    path: `/api/organizations/${organizationId}/observability/overview`,
  });
  const metrics = useApiQuery<ObservabilityMetricsResponse>({
    queryKey: queryKeys.observability.metrics(organizationId),
    path: `/api/organizations/${organizationId}/observability/metrics`,
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
        pending={overview.isFetching}
        requestId={overview.error.requestId}
        title="Unable to load observability overview"
      />
    );
  }

  const data = overview.data;
  const latencySeries = metrics.data?.series.find((item) => item.name === 'http.request.duration_ms');
  const sparkPoints = (latencySeries?.points ?? []).map((point) => ({
    bucket: point.bucketStart,
    value: point.avg,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard hint={`${String(data.requests.errors)} errors`} title="Requests" value={String(data.requests.total)} />
        <KpiCard hint="HTTP error rate" title="Error rate" tone={data.requests.errorRate > 0.05 ? 'danger' : 'default'} value={`${String(Math.round(data.requests.errorRate * 1000) / 10)}%`} />
        <KpiCard hint={`${String(data.ai.errors)} AI errors`} title="AI calls" value={String(data.ai.calls)} />
        <KpiCard hint={`${String(data.incidents.acknowledged)} acknowledged`} title="Open incidents" tone="warning" value={String(data.incidents.open)} />
      </div>
      {sparkPoints.length > 0 ? <Sparkline points={sparkPoints} /> : null}
    </div>
  );
}
