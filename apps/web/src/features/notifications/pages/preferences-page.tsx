import { useMemo, useState } from 'react';
import type { NotificationChannel, NotificationPreferenceListResponse } from '@ai-customer-support/contracts';
import { NOTIFICATION_CHANNELS } from '@ai-customer-support/contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { queryKeys } from '@/services/query-keys';
import { notificationsApi } from '../api';
import { CHANNEL_LABELS, PREFERENCE_EVENTS } from '../labels';

export function NotificationPreferencesPage() {
  const { organizationId } = useWorkspace();
  const prefs = useApiQuery<NotificationPreferenceListResponse>({
    queryKey: queryKeys.notifications.preferences(organizationId),
    path: `/api/organizations/${organizationId}/notification-preferences`,
  });
  const upsert = useApiMutation({
    mutationFn: (items: Array<{ eventType: string; channel: NotificationChannel; enabled: boolean }>) =>
      notificationsApi.upsertPreferences(organizationId, { items }),
    invalidateKeys: [queryKeys.notifications.preferences(organizationId)],
    successMessage: 'Preferences saved',
  });
  const [pendingKey, setPendingKey] = useState<string | undefined>();

  const map = useMemo(() => {
    const next = new Map<string, boolean>();
    for (const item of prefs.data?.items ?? []) {
      next.set(`${item.eventType}:${item.channel}`, item.enabled);
    }
    return next;
  }, [prefs.data?.items]);

  if (prefs.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (prefs.isError) {
    return (
      <QueryErrorAlert
        message={prefs.error.message}
        onRetry={() => {
          void prefs.refetch();
        }}
        pending={prefs.isFetching}
        title="Unable to load preferences"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel preferences</CardTitle>
        <CardDescription>
          Toggle whether each support event is delivered on email, in-app, SMS, or webhook. Unchecked events are skipped.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              {NOTIFICATION_CHANNELS.map((channel) => (
                <TableHead key={channel}>{CHANNEL_LABELS[channel]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PREFERENCE_EVENTS.map((eventType) => (
              <TableRow key={eventType}>
                <TableCell className="font-medium">{eventType}</TableCell>
                {NOTIFICATION_CHANNELS.map((channel) => {
                  const key = `${eventType}:${channel}`;
                  const enabled = map.get(key) ?? false;
                  return (
                    <TableCell key={channel}>
                      <Switch
                        aria-label={`${eventType} via ${CHANNEL_LABELS[channel]}`}
                        checked={enabled}
                        disabled={upsert.isPending && pendingKey === key}
                        onCheckedChange={(next) => {
                          setPendingKey(key);
                          upsert.mutate([{ eventType, channel, enabled: next }], {
                            onSettled: () => {
                              setPendingKey(undefined);
                            },
                          });
                        }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
