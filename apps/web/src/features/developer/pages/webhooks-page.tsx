import { useState, type FormEvent } from 'react';
import type { WebhookDeliveryListResponse, WebhookEventName, WebhookSubscriptionListResponse } from '@ai-customer-support/contracts';
import { isWebhookEventName, WEBHOOK_EVENT_NAMES } from '@ai-customer-support/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/select';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/features/organizations/format';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { developerApi } from '../api';

export function DeveloperWebhooksPage() {
  const { organizationId } = useWorkspace();
  const [selected, setSelected] = useState<string | undefined>();
  const [events, setEvents] = useState<WebhookEventName[]>(['ticket.created']);
  const [secret, setSecret] = useState<string | undefined>();
  const hooks = useApiQuery<WebhookSubscriptionListResponse>({
    queryKey: queryKeys.developer.webhooks(organizationId),
    path: `/api/organizations/${organizationId}/webhooks`,
  });
  const deliveries = useApiQuery<WebhookDeliveryListResponse>({
    queryKey: queryKeys.developer.deliveries(organizationId, selected ?? ''),
    path: `/api/organizations/${organizationId}/webhooks/${selected ?? ''}/deliveries`,
    params: { page: 1, pageSize: 20 },
    enabled: Boolean(selected),
  });
  const createHook = useApiMutation({
    mutationFn: (input: { url: string; events: readonly WebhookEventName[] }) =>
      developerApi.createWebhook(organizationId, input.url, input.events),
    invalidateKeys: [queryKeys.developer.webhooks(organizationId)],
    successMessage: 'Webhook created',
  });
  const retry = useApiMutation({
    mutationFn: (deliveryId: string) => developerApi.retryDelivery(organizationId, selected ?? '', deliveryId),
    invalidateKeys: [queryKeys.developer.deliveries(organizationId, selected ?? '')],
    successMessage: 'Delivery retried',
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hooks.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : hooks.isError ? (
            <QueryErrorAlert message={hooks.error.message} onRetry={() => void hooks.refetch()} title="Unable to load webhooks" />
          ) : (hooks.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="No webhooks" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(hooks.data?.items ?? []).map((hook) => (
                  <TableRow
                    className="cursor-pointer"
                    key={hook.id}
                    onClick={() => {
                      setSelected(hook.id);
                    }}
                  >
                    <TableCell className="max-w-xs truncate">{hook.url}</TableCell>
                    <TableCell className="text-xs">{hook.events.join(', ')}</TableCell>
                    <TableCell>
                      <Badge variant={hook.status === 'active' ? 'success' : 'secondary'}>{hook.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <form
            className="space-y-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const url = (event.currentTarget.elements.namedItem('url') as HTMLInputElement).value.trim();
              if (!url || events.length === 0) {
                return;
              }
              void createHook.mutateAsync({ url, events }).then((result) => {
                setSecret(result.secret);
                event.currentTarget.reset();
              });
            }}
          >
            <Input name="url" placeholder="https://example.com/webhooks" type="url" />
            <MultiSelect
              onValueChange={(next) => {
                setEvents(next.filter(isWebhookEventName));
              }}
              options={WEBHOOK_EVENT_NAMES.map((event) => ({ value: event, label: event }))}
              value={events}
            />
            <Button type="submit">Create webhook</Button>
          </form>
          {secret ? <p className="break-all font-mono text-xs">Signing secret (copy now): {secret}</p> : null}
        </CardContent>
      </Card>
      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Delivery logs</CardTitle>
          </CardHeader>
          <CardContent>
            {deliveries.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : deliveries.isError ? (
              <QueryErrorAlert message={deliveries.error.message} onRetry={() => void deliveries.refetch()} title="Unable to load deliveries" />
            ) : (deliveries.data?.items.length ?? 0) === 0 ? (
              <EmptyState title="No deliveries" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(deliveries.data?.items ?? []).map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell>{delivery.eventName}</TableCell>
                      <TableCell>
                        <Badge variant={delivery.status === 'succeeded' ? 'success' : delivery.status === 'failed' ? 'destructive' : 'secondary'}>
                          {delivery.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {String(delivery.attemptCount)}/{String(delivery.maxAttempts)}
                      </TableCell>
                      <TableCell>{formatDateTime(delivery.createdAt)}</TableCell>
                      <TableCell>
                        {delivery.status === 'failed' || delivery.status === 'pending' ? (
                          <Button onClick={() => retry.mutate(delivery.id)} size="sm" type="button" variant="outline">
                            Retry
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
