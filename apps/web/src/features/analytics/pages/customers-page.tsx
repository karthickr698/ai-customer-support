import type { CustomerAnalyticsResponse } from '@ai-customer-support/contracts';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { useAnalyticsFilters } from '../components/filters';
import { KpiCard } from '../components/kpi-card';

export function CustomerAnalyticsPage() {
  const { organizationId } = useWorkspace();
  const { params } = useAnalyticsFilters();
  const report = useApiQuery<CustomerAnalyticsResponse>({
    queryKey: queryKeys.analytics.customers(organizationId, params),
    path: `/api/organizations/${organizationId}/analytics/customers`,
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
        title="Unable to load customer analytics"
      />
    );
  }

  const data = report.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard title="Customers created" value={String(data.created)} />
        <KpiCard title="With conversations" value={String(data.withConversations)} />
      </div>
      <Card>
        <CardContent className="pt-6">
          {data.topCustomers.length === 0 ? (
            <EmptyState description="Customers with conversations in this period will appear here." title="No customer activity" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Conversations</TableHead>
                  <TableHead>Tickets</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topCustomers.map((customer) => (
                  <TableRow key={customer.customerEmail}>
                    <TableCell>
                      <p className="font-medium">{customer.customerName}</p>
                      <p className="text-xs text-muted-foreground">{customer.customerEmail}</p>
                    </TableCell>
                    <TableCell>{String(customer.conversations)}</TableCell>
                    <TableCell>{String(customer.tickets)}</TableCell>
                    <TableCell>{customer.lastSeenAt ? formatDateTime(customer.lastSeenAt) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
