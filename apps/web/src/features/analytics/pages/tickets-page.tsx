import type { TicketAnalyticsResponse } from '@ai-customer-support/contracts';
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
import { formatSeconds, percent } from '../labels';

export function TicketAnalyticsPage() {
  const { organizationId } = useWorkspace();
  const { params } = useAnalyticsFilters();
  const report = useApiQuery<TicketAnalyticsResponse>({
    queryKey: queryKeys.analytics.tickets(organizationId, params),
    path: `/api/organizations/${organizationId}/analytics/tickets`,
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
        title="Unable to load ticket analytics"
      />
    );
  }

  const data = report.data;
  if (data.created === 0) {
    return <EmptyState description="No tickets were created in this period." title="Empty period" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Created" value={String(data.created)} />
        <KpiCard hint="Resolved / created" title="CSAT (resolution)" value={percent(data.resolved, data.created)} />
        <KpiCard title="SLA breached" tone={data.slaBreached > 0 ? 'danger' : 'default'} value={String(data.slaBreached)} />
        <KpiCard title="Avg resolution" value={formatSeconds(data.averageResolutionSeconds)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.byStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.byPriority} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.bySource} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
