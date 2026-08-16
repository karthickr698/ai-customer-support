import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type {
  AutomationExecutionLogListResponse,
  AutomationJobListResponse,
  AutomationJobStatus,
  AutomationRuleListResponse,
} from '@ai-customer-support/contracts';
import { AUTOMATION_JOB_STATUSES } from '@ai-customer-support/contracts';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { automationsApi } from '../api';
import { EXECUTION_STATUS_LABELS, JOB_STATUS_LABELS, automationsPath } from '../labels';

const PAGE_SIZE = 20;

export function AutomationHistoryPage() {
  const { organizationId, permissions } = useWorkspace();
  const { ruleId } = useParams();
  const canManage = hasPermission(permissions, 'automation.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const filters = useMemo(
    () => ({ page, pageSize: PAGE_SIZE, ruleId, status: status || undefined }),
    [page, ruleId, status],
  );

  const rules = useApiQuery<AutomationRuleListResponse>({
    queryKey: queryKeys.automations.rules(organizationId),
    path: `/api/organizations/${organizationId}/automations`,
  });
  const jobs = useApiQuery<AutomationJobListResponse>({
    queryKey: queryKeys.automations.jobs(organizationId, filters),
    path: `/api/organizations/${organizationId}/automation-jobs`,
    params: filters,
  });
  const logs = useApiQuery<AutomationExecutionLogListResponse>({
    queryKey: queryKeys.automations.logs(organizationId, { ...filters, pageSize: 20 }),
    path: `/api/organizations/${organizationId}/automation-logs`,
    params: { ...filters, pageSize: 20 },
  });
  const retry = useApiMutation({
    mutationFn: (jobId: string) => automationsApi.retryJob(organizationId, jobId),
    invalidateKeys: [queryKeys.automations.jobs(organizationId), queryKeys.automations.logs(organizationId)],
    successMessage: 'Job retried',
  });

  const ruleName = (id: string): string => rules.data?.items.find((item) => item.id === id)?.name ?? id;
  const jobItems = jobs.data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((jobs.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          onValueChange={(value) => {
            const next = new URLSearchParams(searchParams);
            if (value) {
              next.set('status', value);
            } else {
              next.delete('status');
            }
            next.delete('page');
            setSearchParams(next);
          }}
          options={[
            { value: '', label: 'Any status' },
            ...AUTOMATION_JOB_STATUSES.map((item) => ({ value: item, label: JOB_STATUS_LABELS[item] })),
          ]}
          searchable={false}
          value={status}
        />
        {ruleId ? (
          <Button asChild size="sm" variant="outline">
            <Link to={automationsPath(organizationId, ruleId)}>Edit workflow</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
          <CardDescription>Queued, running, and completed workflow executions.</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : jobs.isError ? (
            <QueryErrorAlert
              message={jobs.error.message}
              onRetry={() => {
                void jobs.refetch();
              }}
              pending={jobs.isFetching}
              title="Unable to load jobs"
            />
          ) : jobItems.length === 0 ? (
            <EmptyState
              description="Run a workflow in test mode or wait for a matching event."
              icon={<History className="size-8" />}
              title="No executions yet"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobItems.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{ruleName(job.ruleId)}</TableCell>
                      <TableCell className="capitalize">{job.triggerKind}</TableCell>
                      <TableCell>
                        <Badge variant={jobStatusVariant(job.status)}>{JOB_STATUS_LABELS[job.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        {String(job.attempt)}/{String(job.maxAttempts)}
                      </TableCell>
                      <TableCell>{formatDateTime(job.updatedAt)}</TableCell>
                      <TableCell>
                        {canManage && (job.status === 'dead' || job.status === 'pending') ? (
                          <Button
                            disabled={retry.isPending}
                            onClick={() => {
                              retry.mutate(job.id);
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Retry
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4">
                <Pagination
                  onPageChange={(nextPage) => {
                    const next = new URLSearchParams(searchParams);
                    if (nextPage <= 1) {
                      next.delete('page');
                    } else {
                      next.set('page', String(nextPage));
                    }
                    setSearchParams(next);
                  }}
                  page={page}
                  pageCount={pageCount}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution logs</CardTitle>
          <CardDescription>Attempt-level input and output for debugging.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : logs.isError ? (
            <QueryErrorAlert
              message={logs.error.message}
              onRetry={() => {
                void logs.refetch();
              }}
              pending={logs.isFetching}
              title="Unable to load logs"
            />
          ) : (logs.data?.items.length ?? 0) === 0 ? (
            <EmptyState description="Each job attempt writes a log row." title="No logs" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logs.data?.items ?? []).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={log.status === 'failed' ? 'destructive' : 'secondary'}>
                        {EXECUTION_STATUS_LABELS[log.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{log.message ?? '—'}</TableCell>
                    <TableCell>{formatDateTime(log.startedAt)}</TableCell>
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

function jobStatusVariant(
  status: AutomationJobStatus,
): 'secondary' | 'success' | 'destructive' | 'warning' | 'outline' {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'dead':
      return 'destructive';
    case 'running':
      return 'warning';
    case 'skipped':
      return 'outline';
    default:
      return 'secondary';
  }
}
