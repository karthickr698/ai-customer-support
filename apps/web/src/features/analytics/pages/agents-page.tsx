import type { AgentAnalyticsResponse } from '@ai-customer-support/contracts';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { useAnalyticsFilters } from '../components/filters';
import { formatSeconds } from '../labels';

export function AgentAnalyticsPage() {
  const { organizationId } = useWorkspace();
  const { params } = useAnalyticsFilters();
  const report = useApiQuery<AgentAnalyticsResponse>({
    queryKey: queryKeys.analytics.agents(organizationId, params),
    path: `/api/organizations/${organizationId}/analytics/agents`,
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
        title="Unable to load agent metrics"
      />
    );
  }

  const agents = report.data.agents;
  if (agents.length === 0) {
    return <EmptyState description="No assigned work in this period." title="No agent activity" />;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Conversations</TableHead>
              <TableHead>Tickets</TableHead>
              <TableHead>First response</TableHead>
              <TableHead>Resolution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.agentId}>
                <TableCell>
                  <p className="font-medium">{agent.displayName ?? agent.email ?? agent.agentId}</p>
                  <p className="text-xs text-muted-foreground">{agent.email}</p>
                </TableCell>
                <TableCell>
                  {String(agent.conversationsAssigned)} assigned / {String(agent.conversationsResolved)} resolved
                </TableCell>
                <TableCell>
                  {String(agent.ticketsAssigned)} assigned / {String(agent.ticketsResolved)} resolved
                </TableCell>
                <TableCell>{formatSeconds(agent.averageTicketFirstResponseSeconds)}</TableCell>
                <TableCell>{formatSeconds(agent.averageTicketResolutionSeconds)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
