import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  BillingInvoiceListResponse,
  BillingPaymentMethodListResponse,
  BillingPlanDto,
  BillingPlanListResponse,
  BillingSubscriptionResponse,
  BillingUsageResponse,
} from '@ai-customer-support/contracts';
import { CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { Progress } from '@/components/ui/progress';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/features/organizations/components/confirm-dialog';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { WorkspacePage } from '@/features/organizations/components/workspace-page';
import { formatDateTime } from '@/features/organizations/format';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { ApiError } from '@/services/api-error';
import { queryKeys } from '@/services/query-keys';
import { billingApi } from '../api';
import { formatCents, INVOICE_LABELS, METRIC_LABELS, SUBSCRIPTION_LABELS } from '../labels';

export function BillingPage() {
  return (
    <RequireWorkspacePermission
      description="You need billing.read to view plans, usage, and invoices."
      permission="billing.read"
      title="Billing is unavailable"
    >
      <BillingWorkspace />
    </RequireWorkspacePermission>
  );
}

function BillingWorkspace() {
  const { organizationId, permissions } = useWorkspace();
  const canManage = hasPermission(permissions, 'billing.manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'plans';
  const invoicePage = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const [pendingPlan, setPendingPlan] = useState<BillingPlanDto | undefined>();
  const [cancelOpen, setCancelOpen] = useState(false);

  const plans = useApiQuery<BillingPlanListResponse>({
    queryKey: queryKeys.billing.plans(),
    path: '/api/billing/plans',
  });
  const subscription = useApiQuery<BillingSubscriptionResponse>({
    queryKey: queryKeys.billing.subscription(organizationId),
    path: `/api/organizations/${organizationId}/billing/subscription`,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const usage = useApiQuery<BillingUsageResponse>({
    queryKey: queryKeys.billing.usage(organizationId),
    path: `/api/organizations/${organizationId}/billing/usage`,
    enabled: subscription.isSuccess,
  });
  const invoices = useApiQuery<BillingInvoiceListResponse>({
    queryKey: queryKeys.billing.invoices(organizationId, { page: invoicePage }),
    path: `/api/organizations/${organizationId}/billing/invoices`,
    params: { page: invoicePage, pageSize: 20 },
    enabled: subscription.isSuccess,
  });
  const methods = useApiQuery<BillingPaymentMethodListResponse>({
    queryKey: queryKeys.billing.paymentMethods(organizationId),
    path: `/api/organizations/${organizationId}/billing/payment-methods`,
    enabled: subscription.isSuccess,
  });

  const checkout = useApiMutation({
    mutationFn: (planSlug: string) =>
      billingApi.startCheckout(organizationId, {
        planSlug,
        successUrl: window.location.href,
        cancelUrl: window.location.href,
      }),
    invalidateKeys: [queryKeys.billing.all()],
  });
  const completeCheckout = useApiMutation({
    mutationFn: (sessionId: string) => billingApi.completeCheckout(organizationId, { sessionId }),
    invalidateKeys: [queryKeys.billing.all()],
    successMessage: 'Subscription activated',
  });
  const changePlan = useApiMutation({
    mutationFn: (planSlug: string) => billingApi.changePlan(organizationId, { planSlug }),
    invalidateKeys: [queryKeys.billing.all()],
    successMessage: 'Plan updated',
  });
  const cancel = useApiMutation({
    mutationFn: () => billingApi.cancel(organizationId, { immediately: false }),
    invalidateKeys: [queryKeys.billing.all()],
    successMessage: 'Subscription will cancel at period end',
  });
  const resume = useApiMutation({
    mutationFn: () => billingApi.resume(organizationId),
    invalidateKeys: [queryKeys.billing.all()],
    successMessage: 'Subscription resumed',
  });
  const pay = useApiMutation({
    mutationFn: (invoiceId: string) => billingApi.payInvoice(organizationId, invoiceId),
    invalidateKeys: [queryKeys.billing.invoices(organizationId)],
    successMessage: 'Invoice paid',
  });

  const current = subscription.data?.subscription;
  const missingSubscription = subscription.error instanceof ApiError && subscription.error.status === 404;
  const currentAmount = current?.amountCents ?? 0;

  const rankedPlans = useMemo(
    () => [...(plans.data?.items ?? [])].sort((a, b) => a.amountCents - b.amountCents),
    [plans.data?.items],
  );

  async function applyPlan(plan: BillingPlanDto): Promise<void> {
    if (!current) {
      const result = await checkout.mutateAsync(plan.slug);
      if (result.checkout.url) {
        window.location.assign(result.checkout.url);
        return;
      }
      await completeCheckout.mutateAsync(result.checkout.id);
      return;
    }
    await changePlan.mutateAsync(plan.slug);
  }

  return (
    <WorkspacePage wide>
      <PageHeader
        description="Plans, metered usage, invoices, and payment methods for this workspace."
        title="Billing"
      />

      {subscription.isPending ? <Skeleton className="h-24 w-full" /> : null}
      {subscription.isError && !missingSubscription ? (
        <QueryErrorAlert
          message={subscription.error.message}
          onRetry={() => {
            void subscription.refetch();
          }}
          pending={subscription.isFetching}
          title="Unable to load subscription"
        />
      ) : null}

      {current ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {current.planName}
              <Badge variant={current.status === 'active' || current.status === 'trialing' ? 'success' : 'warning'}>
                {SUBSCRIPTION_LABELS[current.status]}
              </Badge>
            </CardTitle>
            <CardDescription>
              {formatCents(current.amountCents, current.currency)} / {current.interval}. Period ends{' '}
              {formatDateTime(current.currentPeriodEnd)}.
              {current.cancelAtPeriodEnd ? ' Cancels at period end.' : ''}
            </CardDescription>
          </CardHeader>
          {canManage ? (
            <CardContent className="flex flex-wrap gap-2">
              {current.cancelAtPeriodEnd ? (
                <Button disabled={resume.isPending} onClick={() => resume.mutate()} type="button" variant="outline">
                  Resume subscription
                </Button>
              ) : (
                <Button onClick={() => setCancelOpen(true)} type="button" variant="outline">
                  Downgrade / cancel
                </Button>
              )}
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <Tabs
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          next.set('tab', value);
          next.delete('page');
          setSearchParams(next);
        }}
        value={tab}
      >
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="usage">Usage & limits</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment">Payment methods</TabsTrigger>
        </TabsList>
        <TabsContent value="plans">
          {plans.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : plans.isError ? (
            <QueryErrorAlert
              message={plans.error.message}
              onRetry={() => {
                void plans.refetch();
              }}
              pending={plans.isFetching}
              title="Unable to load plans"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rankedPlans.map((plan) => {
                const isCurrent = current?.planSlug === plan.slug;
                const isUpgrade = plan.amountCents > currentAmount;
                return (
                  <Card key={plan.id}>
                    <CardHeader>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-2xl font-semibold">
                        {formatCents(plan.amountCents, plan.currency)}
                        <span className="text-sm font-normal text-muted-foreground"> / {plan.interval}</span>
                      </p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {plan.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                      {canManage ? (
                        <Button
                          disabled={isCurrent || checkout.isPending || changePlan.isPending}
                          onClick={() => {
                            setPendingPlan(plan);
                          }}
                          type="button"
                          variant={isCurrent ? 'secondary' : 'default'}
                        >
                          {isCurrent ? 'Current plan' : isUpgrade || !current ? 'Upgrade' : 'Downgrade'}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="usage">
          {missingSubscription ? (
            <EmptyState description="Subscribe to a plan to meter usage against quotas." title="No subscription" />
          ) : usage.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : usage.isError ? (
            <QueryErrorAlert
              message={usage.error.message}
              onRetry={() => {
                void usage.refetch();
              }}
              pending={usage.isFetching}
              title="Unable to load usage"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(usage.data?.items ?? []).map((item) => {
                const included = item.included ?? 0;
                const pct = item.unlimited || included <= 0 ? 0 : Math.min(100, (item.used / included) * 100);
                return (
                  <Card key={item.metric}>
                    <CardHeader>
                      <CardTitle>{METRIC_LABELS[item.metric]}</CardTitle>
                      <CardDescription>
                        {item.unlimited
                          ? `${String(item.used)} used · unlimited`
                          : `${String(item.used)} / ${String(item.included)} included · ${String(item.remaining ?? 0)} remaining`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Progress value={item.unlimited ? 0 : pct} />
                      {item.overage > 0 ? (
                        <p className="mt-2 text-xs text-destructive">{String(item.overage)} overage units</p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="invoices">
          {missingSubscription ? (
            <EmptyState description="Invoices appear after a subscription is active." title="No invoices" />
          ) : invoices.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : invoices.isError ? (
            <QueryErrorAlert
              message={invoices.error.message}
              onRetry={() => {
                void invoices.refetch();
              }}
              pending={invoices.isFetching}
              title="Unable to load invoices"
            />
          ) : (invoices.data?.items.length ?? 0) === 0 ? (
            <EmptyState description="Issued invoices for this workspace will be listed here." icon={<CreditCard className="size-8" />} title="No invoices" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoices.data?.items ?? []).map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.number}</TableCell>
                      <TableCell>
                        <Badge variant={invoice.status === 'paid' ? 'success' : invoice.status === 'open' ? 'warning' : 'secondary'}>
                          {INVOICE_LABELS[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCents(invoice.totalCents, invoice.currency)}</TableCell>
                      <TableCell>{formatDateTime(invoice.dueAt)}</TableCell>
                      <TableCell>
                        {canManage && invoice.status === 'open' ? (
                          <Button
                            onClick={() => {
                              pay.mutate(invoice.id);
                            }}
                            size="sm"
                            type="button"
                          >
                            Pay
                          </Button>
                        ) : invoice.hostedUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={invoice.hostedUrl} rel="noreferrer" target="_blank">
                              View
                            </a>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4">
                <Pagination
                  onPageChange={(page) => {
                    const next = new URLSearchParams(searchParams);
                    next.set('tab', 'invoices');
                    if (page <= 1) {
                      next.delete('page');
                    } else {
                      next.set('page', String(page));
                    }
                    setSearchParams(next);
                  }}
                  page={invoicePage}
                  pageCount={Math.max(1, Math.ceil((invoices.data?.total ?? 0) / 20))}
                />
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="payment">
          {missingSubscription ? (
            <EmptyState description="Payment methods are stored after checkout." title="No payment methods" />
          ) : methods.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : methods.isError ? (
            <QueryErrorAlert
              message={methods.error.message}
              onRetry={() => {
                void methods.refetch();
              }}
              pending={methods.isFetching}
              title="Unable to load payment methods"
            />
          ) : (methods.data?.items.length ?? 0) === 0 ? (
            <EmptyState description="Cards collected by the billing provider appear here." title="No payment methods" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Last four</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Default</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(methods.data?.items ?? []).map((method) => (
                  <TableRow key={method.id}>
                    <TableCell className="capitalize">{method.brand ?? method.provider}</TableCell>
                    <TableCell>{method.lastFour ? `•••• ${method.lastFour}` : '—'}</TableCell>
                    <TableCell>
                      {method.expMonth && method.expYear ? `${String(method.expMonth)}/${String(method.expYear)}` : '—'}
                    </TableCell>
                    <TableCell>{method.isDefault ? 'Yes' : 'No'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        confirmLabel={pendingPlan ? (current && pendingPlan.amountCents < currentAmount ? 'Downgrade' : 'Upgrade') : 'Continue'}
        description={
          pendingPlan
            ? current
              ? `Switch this workspace to ${pendingPlan.name} (${formatCents(pendingPlan.amountCents, pendingPlan.currency)} / ${pendingPlan.interval}).`
              : `Start checkout for ${pendingPlan.name}.`
            : ''
        }
        onConfirm={() => {
          if (pendingPlan) {
            void applyPlan(pendingPlan);
          }
          setPendingPlan(undefined);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPlan(undefined);
          }
        }}
        open={Boolean(pendingPlan)}
        pending={checkout.isPending || changePlan.isPending || completeCheckout.isPending}
        title={pendingPlan && current && pendingPlan.amountCents < currentAmount ? 'Downgrade plan?' : 'Upgrade plan?'}
      />
      <ConfirmDialog
        confirmLabel="Cancel at period end"
        description="You keep access until the current period ends. You can resume before then."
        onConfirm={() => {
          cancel.mutate();
          setCancelOpen(false);
        }}
        onOpenChange={setCancelOpen}
        open={cancelOpen}
        pending={cancel.isPending}
        title="Cancel subscription?"
        variant="destructive"
      />
    </WorkspacePage>
  );
}
