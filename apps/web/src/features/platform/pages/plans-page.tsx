import type { BillingPlanListResponse, PlatformFeatureFlagListResponse } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCents } from '@/features/billing/labels';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { platformApi } from '../api';
import { hasPlatformPermission } from '../permissions';
import { usePlatformOperator } from '../platform-context';

export function PlatformPlansPage() {
  const operator = usePlatformOperator();
  const canManageFlags = hasPlatformPermission(operator, 'platform.feature_flags.manage');

  const plans = useApiQuery<BillingPlanListResponse>({
    queryKey: queryKeys.platform.plans(),
    path: '/api/billing/plans',
  });
  const flags = useApiQuery<PlatformFeatureFlagListResponse>({
    queryKey: queryKeys.platform.flags(),
    path: '/api/platform/feature-flags',
  });
  const updateFlag = useApiMutation({
    mutationFn: (input: { key: string; enabled: boolean }) => platformApi.updateFlag(input.key, input.enabled),
    invalidateKeys: [queryKeys.platform.flags(), queryKeys.featureFlags.all()],
    successMessage: 'Feature flag updated',
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Billing plans</CardTitle>
          <CardDescription>Catalog from GET /api/billing/plans. Tenant checkout stays in workspace billing.</CardDescription>
        </CardHeader>
        <CardContent>
          {plans.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : plans.isError ? (
            <QueryErrorAlert
              message={plans.error.message}
              onRetry={() => {
                void plans.refetch();
              }}
              requestId={plans.error.requestId}
              title="Unable to load plans"
            />
          ) : (plans.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No plans" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(plans.data?.items ?? []).map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </TableCell>
                    <TableCell>{formatCents(plan.amountCents, plan.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={plan.active ? 'success' : 'secondary'}>{plan.active ? 'active' : 'inactive'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
          <CardDescription>Global defaults. Tenant overrides are stored on each flag.</CardDescription>
        </CardHeader>
        <CardContent>
          {flags.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : flags.isError ? (
            <QueryErrorAlert
              message={flags.error.message}
              onRetry={() => {
                void flags.refetch();
              }}
              requestId={flags.error.requestId}
              title="Unable to load feature flags"
            />
          ) : (flags.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No feature flags" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Overrides</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(flags.data?.items ?? []).map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell>
                      <p className="font-mono text-sm">{flag.key}</p>
                      {flag.description ? <p className="text-xs text-muted-foreground">{flag.description}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={flag.enabled}
                        disabled={!canManageFlags}
                        onCheckedChange={(enabled) => {
                          updateFlag.mutate({ key: flag.key, enabled });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {flag.overrides.length === 0
                        ? 'None'
                        : flag.overrides.map((item) => `${item.organizationId}:${item.enabled ? 'on' : 'off'}`).join(', ')}
                    </TableCell>
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
