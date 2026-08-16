import { Link } from 'react-router-dom';
import type { AutomationRuleListResponse } from '@ai-customer-support/contracts';
import { GitBranch, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { automationsApi } from '../api';
import { ACTION_LABELS, TRIGGER_LABELS, automationsPath } from '../labels';

export function AutomationsIndexPage() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'automation.manage');
  const rules = useApiQuery<AutomationRuleListResponse>({
    queryKey: queryKeys.automations.rules(organizationId),
    path: `/api/organizations/${organizationId}/automations`,
  });
  const toggle = useApiMutation({
    mutationFn: (input: { id: string; enabled: boolean }) =>
      input.enabled ? automationsApi.enable(organizationId, input.id) : automationsApi.disable(organizationId, input.id),
    invalidateKeys: [queryKeys.automations.rules(organizationId)],
    successMessage: 'Rule updated',
  });
  const dispatch = useApiMutation({
    mutationFn: () => automationsApi.dispatch(organizationId),
    successMessage: 'Queued due automations',
  });

  const items = rules.data?.items ?? [];

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canManage ? (
            <>
              <Button
                disabled={dispatch.isPending}
                onClick={() => {
                  dispatch.mutate();
                }}
                type="button"
                variant="outline"
              >
                Dispatch due jobs
              </Button>
              <Button asChild>
                <Link to={automationsPath(organizationId, 'new')}>
                  <Plus />
                  New workflow
                </Link>
              </Button>
            </>
          ) : null}
        </div>
        {rules.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : rules.isError ? (
          <QueryErrorAlert
            message={rules.error.message}
            onRetry={() => {
              void rules.refetch();
            }}
            pending={rules.isFetching}
            title="Unable to load workflows"
          />
        ) : items.length === 0 ? (
          <EmptyState
            action={
              canManage ? (
                <Button asChild>
                  <Link to={automationsPath(organizationId, 'new')}>Create a workflow</Link>
                </Button>
              ) : undefined
            }
            description="Rules listen for workspace events or a cron schedule, then run an action when conditions match."
            icon={<GitBranch className="size-8" />}
            title="No workflow rules"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" to={automationsPath(organizationId, rule.id)}>
                      {rule.name}
                    </Link>
                    {rule.description ? (
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TRIGGER_LABELS[rule.triggerType]}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">{rule.eventName ?? rule.schedule ?? '—'}</p>
                  </TableCell>
                  <TableCell>{ACTION_LABELS[rule.actionType]}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      disabled={!canManage || toggle.isPending}
                      onCheckedChange={(enabled) => {
                        toggle.mutate({ id: rule.id, enabled });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={automationsPath(organizationId, `${rule.id}/history`)}>History</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
