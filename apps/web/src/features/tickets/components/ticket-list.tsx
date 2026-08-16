import type { TicketDto, TicketListResponse } from '@ai-customer-support/contracts';
import { Ticket } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/features/conversations/format';
import { cn } from '@/lib/utils';
import { TICKET_SOURCE_LABELS } from '../labels';
import { SlaBadge, TicketPriorityBadge, TicketStatusBadge } from './ticket-badges';
import { SlaTimers } from './sla-timer';

export function TicketList({
  data,
  selectedId,
  isPending,
  isError,
  errorMessage,
  onRetry,
  retryPending,
  onSelect,
  onPageChange,
}: {
  readonly data: TicketListResponse | undefined;
  readonly selectedId: string | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly errorMessage?: string;
  readonly onRetry: () => void;
  readonly retryPending: boolean;
  readonly onSelect: (ticketId: string) => void;
  readonly onPageChange: (page: number) => void;
}) {
  const items = data?.items ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (isPending && items.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorAlert
          message={errorMessage ?? 'Unable to load tickets'}
          onRetry={onRetry}
          pending={retryPending}
          title="Ticket queue failed"
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          description="Create a ticket or change filters to see the queue."
          icon={<Ticket className="size-8" />}
          title="No tickets match"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <ul className="flex flex-col p-2">
          {items.map((ticket) => (
            <li key={ticket.id}>
              <TicketListItem onSelect={onSelect} selected={ticket.id === selectedId} ticket={ticket} />
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
          {String(data?.total ?? 0)} ticket{(data?.total ?? 0) === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

function TicketListItem({
  ticket,
  selected,
  onSelect,
}: {
  readonly ticket: TicketDto;
  readonly selected: boolean;
  readonly onSelect: (ticketId: string) => void;
}) {
  return (
    <button
      className={cn(
        'flex w-full flex-col gap-2 rounded-lg px-3 py-3 text-left',
        'hover:bg-accent/60',
        selected && 'bg-accent text-accent-foreground',
      )}
      onClick={() => {
        onSelect(ticket.id);
      }}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium">{ticket.subject}</p>
        <TicketPriorityBadge priority={ticket.priority} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TicketStatusBadge status={ticket.status} />
        <SlaBadge sla={ticket.sla} />
        <span className="text-xs text-muted-foreground">{TICKET_SOURCE_LABELS[ticket.source]}</span>
      </div>
      <SlaTimers sla={ticket.sla} />
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{ticket.customerName}</span>
        <span>{formatRelativeTime(ticket.updatedAt)}</span>
      </div>
    </button>
  );
}
