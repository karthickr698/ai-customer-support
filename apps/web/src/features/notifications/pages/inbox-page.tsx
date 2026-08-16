import { Link, useSearchParams } from 'react-router-dom';
import type { NotificationInboxListResponse } from '@ai-customer-support/contracts';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/features/conversations/format';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/services/query-keys';
import { notificationsApi } from '../api';
import { notificationDeepLink } from '../labels';

const PAGE_SIZE = 20;

export function NotificationInboxPage() {
  const { organizationId } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadOnly = searchParams.get('unread') === '1';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const filters = { page, pageSize: PAGE_SIZE, unreadOnly };

  const inbox = useApiQuery<NotificationInboxListResponse>({
    queryKey: queryKeys.notifications.inbox(organizationId, filters),
    path: `/api/organizations/${organizationId}/notifications/inbox`,
    params: { page, pageSize: PAGE_SIZE, unreadOnly: unreadOnly ? 'true' : undefined },
  });
  const markRead = useApiMutation({
    mutationFn: (itemId: string) => notificationsApi.markRead(organizationId, itemId),
    invalidateKeys: [queryKeys.notifications.all()],
  });
  const markAll = useApiMutation({
    mutationFn: () => notificationsApi.markAllRead(organizationId),
    invalidateKeys: [queryKeys.notifications.all()],
    successMessage: 'All notifications marked read',
  });

  const items = inbox.data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((inbox.data?.total ?? 0) / PAGE_SIZE));

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1" role="tablist" aria-label="Notification filter">
            <FilterChip
              active={!unreadOnly}
              label="All"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('unread');
                next.delete('page');
                setSearchParams(next);
              }}
            />
            <FilterChip
              active={unreadOnly}
              label="Unread"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.set('unread', '1');
                next.delete('page');
                setSearchParams(next);
              }}
            />
          </div>
          <Button
            disabled={markAll.isPending || (inbox.data?.unreadCount ?? 0) === 0}
            onClick={() => {
              markAll.mutate();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Mark all read
          </Button>
        </div>
        {inbox.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : inbox.isError ? (
          <QueryErrorAlert
            message={inbox.error.message}
            onRetry={() => {
              void inbox.refetch();
            }}
            pending={inbox.isFetching}
            title="Unable to load notifications"
          />
        ) : items.length === 0 ? (
          <EmptyState
            description={unreadOnly ? 'You are caught up.' : 'In-app deliveries will appear here.'}
            icon={<Bell className="size-8" />}
            title={unreadOnly ? 'No unread notifications' : 'No notifications'}
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const unread = item.readAt === null;
                const href = notificationDeepLink(organizationId, item.eventType);
                return (
                  <li key={item.id}>
                    <Link
                      className={cn(
                        'flex flex-col gap-1 rounded-md px-3 py-3 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        unread && 'bg-primary/5',
                      )}
                      onClick={() => {
                        if (unread) {
                          markRead.mutate(item.id);
                        }
                      }}
                      to={href}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{item.title}</p>
                        <div className="flex items-center gap-2">
                          {unread ? <Badge>Unread</Badge> : null}
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(item.createdAt)}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.body}</p>
                      <p className="text-xs text-muted-foreground">{item.eventType}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
      )}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
    </button>
  );
}
