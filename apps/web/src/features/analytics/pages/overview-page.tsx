import { Link, useLocation } from 'react-router-dom';
import type { AnalyticsOverviewResponse, AnalyticsTimeSeriesResponse } from '@ai-customer-support/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { BarList, Sparkline } from '../components/charts';
import { useAnalyticsFilters } from '../components/filters';
import { KpiCard } from '../components/kpi-card';
import { analyticsPath, formatSeconds, namedCount, percent } from '../labels';

export function AnalyticsOverviewPage() {
  const { organizationId } = useWorkspace();
  const { params, filters } = useAnalyticsFilters();
  const location = useLocation();
  const overview = useApiQuery<AnalyticsOverviewResponse>({
    queryKey: queryKeys.analytics.overview(organizationId, params),
    path: `/api/organizations/${organizationId}/analytics/overview`,
    params,
  });
  const series = useApiQuery<AnalyticsTimeSeriesResponse>({
    queryKey: queryKeys.analytics.timeseries(organizationId, params),
    path: `/api/organizations/${organizationId}/analytics/timeseries`,
    params: {
      ...params,
      metrics: 'conversations.created,tickets.created,tickets.resolved,messages.ai',
    },
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
        title="Unable to load analytics"
      />
    );
  }

  const data = overview.data;
  const aiMessages = namedCount(data.messages.byAuthorType, 'ai');
  const agentMessages = namedCount(data.messages.byAuthorType, 'agent');
  const customerMessages = namedCount(data.messages.byAuthorType, 'customer');
  const resolutionRate = percent(data.tickets.created - data.tickets.openNow, data.tickets.created);
  const conversationSeries = series.data?.series.find((item) => item.metric === 'conversations.created');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard hint={`${String(data.conversations.openNow)} open now`} title="Conversations created" value={String(data.conversations.created)} />
        <KpiCard
          hint="AI messages / all messages in the period"
          title="AI resolution share"
          tone="success"
          value={percent(aiMessages, data.messages.created)}
        />
        <KpiCard
          hint="Tickets that left open in this snapshot vs created. Survey CSAT is not exposed by the analytics API."
          title="CSAT (resolution rate)"
          value={resolutionRate}
        />
        <KpiCard
          hint={`Tickets ${formatSeconds(data.tickets.averageFirstResponseSeconds)}`}
          title="First response"
          value={formatSeconds(data.conversations.averageFirstResponseSeconds)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversation volume</CardTitle>
            <CardDescription>Created conversations by {filters.granularity}.</CardDescription>
          </CardHeader>
          <CardContent>
            {series.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : series.isError ? (
              <QueryErrorAlert
                message={series.error.message}
                onRetry={() => {
                  void series.refetch();
                }}
                pending={series.isFetching}
                title="Time series failed"
              />
            ) : (
              <Sparkline points={conversationSeries?.points ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tickets by priority</CardTitle>
            <CardDescription>
              <Link className="hover:underline" to={`${analyticsPath(organizationId, 'tickets')}${location.search}`}>
                Open ticket drilldown
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarList items={data.tickets.byPriority} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Conversations by status</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.conversations.byStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Channel mix</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={data.conversations.byChannel} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Message authors</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              items={[
                { name: 'customer', count: customerMessages },
                { name: 'agent', count: agentMessages },
                { name: 'ai', count: aiMessages },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
