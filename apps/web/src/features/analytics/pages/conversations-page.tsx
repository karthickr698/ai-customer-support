import type { ConversationAnalyticsResponse } from '@ai-customer-support/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { BarList } from '../components/charts';
import { useAnalyticsFilters } from '../components/filters';
import { KpiCard } from '../components/kpi-card';
import { formatSeconds } from '../labels';

export function ConversationAnalyticsPage() {
  const { organizationId } = useWorkspace();
  const { params } = useAnalyticsFilters();
  const report = useApiQuery<ConversationAnalyticsResponse>({
    queryKey: queryKeys.analytics.conversations(organizationId, params),
    path: `/api/organizations/${organizationId}/analytics/conversations`,
    params,
  });

  if (report.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (report.isError) {
    return (
      <QueryErrorAlert
        message={report.error.message}
        onRetry={() => {
          void report.refetch();
        }}
        pending={report.isFetching}
        title="Unable to load conversation analytics"
      />
    );
  }

  const data = report.data;
  if (data.created === 0) {
    return <EmptyState description="No conversations were created in this period." title="Empty period" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="Created" value={String(data.created)} />
        <KpiCard title="Unassigned" value={String(data.unassigned)} />
        <KpiCard title="First response" value={formatSeconds(data.averageFirstResponseSeconds)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.byStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By channel</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.byChannel} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By tag</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList empty="No tagged conversations." items={data.byTag} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
