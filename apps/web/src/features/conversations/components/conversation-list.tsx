import type { ConversationDto, ConversationListResponse } from '@ai-customer-support/contracts';
import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MemberAvatar } from '@/features/organizations/components/member-avatar';
import { conversationTitle, formatRelativeTime } from '../format';
import { CHANNEL_LABELS } from '../labels';
import { PriorityBadge, StatusBadge } from './conversation-badges';

export function ConversationList({
  data,
  selectedId,
  isPending,
  onSelect,
  onPageChange,
}: {
  readonly data: ConversationListResponse | undefined;
  readonly selectedId: string | undefined;
  readonly isPending: boolean;
  readonly onSelect: (conversationId: string) => void;
  readonly onPageChange: (page: number) => void;
}) {
  const items = data?.items ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (isPending && items.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          description="Try a different search or clear filters to see more conversations."
          icon={<Inbox className="size-8" />}
          title="No conversations"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col p-2">
          {items.map((conversation) => (
            <li key={conversation.id}>
              <ConversationListItem
                conversation={conversation}
                onSelect={onSelect}
                selected={conversation.id === selectedId}
              />
            </li>
          ))}
        </ul>
      </ScrollArea>
      {data && data.total > data.pageSize ? (
        <div className="border-t border-border px-3 py-2">
          <Pagination onPageChange={onPageChange} page={data.page} pageCount={pageCount} />
        </div>
      ) : (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {String(data?.total ?? 0)} conversation{(data?.total ?? 0) === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

function ConversationListItem({
  conversation,
  selected,
  onSelect,
}: {
  readonly conversation: ConversationDto;
  readonly selected: boolean;
  readonly onSelect: (conversationId: string) => void;
}) {
  return (
    <button
      aria-current={selected ? 'page' : undefined}
      className={cn(
        'flex w-full gap-3 rounded-lg px-3 py-3 text-left transition-colors',
        'hover:bg-accent/60',
        selected && 'bg-accent text-accent-foreground',
      )}
      onClick={() => {
        onSelect(conversation.id);
      }}
      type="button"
    >
      <MemberAvatar className="mt-0.5 size-9" email={conversation.customerEmail} name={conversation.customerName} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium">{conversation.customerName}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeTime(conversation.lastMessageAt ?? conversation.updatedAt)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-foreground">
          {conversationTitle(conversation)}
        </span>
        <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {conversation.lastMessagePreview ?? 'No messages yet'}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={conversation.status} />
          {conversation.priority !== 'normal' ? <PriorityBadge priority={conversation.priority} /> : null}
          <span className="text-[11px] text-muted-foreground">{CHANNEL_LABELS[conversation.channel]}</span>
          {conversation.assignedAgent ? (
            <span className="truncate text-[11px] text-muted-foreground">
              {conversation.assignedAgent.displayName}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Unassigned</span>
          )}
        </span>
      </span>
    </button>
  );
}
