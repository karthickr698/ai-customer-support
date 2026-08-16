import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  CreateTicketRequest,
  OrganizationMembersResponse,
  TicketAttachmentDto,
  TicketDto,
  TicketListResponse,
  TicketNoteListResponse,
  TicketResponse,
  TicketStatus,
} from '@ai-customer-support/contracts';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { useAuthStore } from '@/features/identity/auth-store';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { workspacePath } from '@/features/organizations/workspace-paths';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/services/query-keys';
import { ticketsApi } from '../api';
import { CreateTicketDialog } from '../components/create-ticket-dialog';
import { TicketDetails } from '../components/ticket-details';
import { TicketFilters, type TicketQueueFilters } from '../components/ticket-filters';
import { TicketList } from '../components/ticket-list';
import { QUEUE_VIEWS, TICKET_PAGE_SIZE } from '../labels';

export function TicketQueuePage() {
  const { organizationId } = useWorkspace();
  const { ticketId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sessionAttachments, setSessionAttachments] = useState<Record<string, TicketAttachmentDto[]>>({});

  const filters = filtersFromSearch(searchParams);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const view = QUEUE_VIEWS.find((item) => item.value === filters.view) ?? QUEUE_VIEWS[0];

  const listParams = {
    page,
    pageSize: TICKET_PAGE_SIZE,
    q: filters.q || undefined,
    status: view?.status,
    priority: filters.priority || undefined,
    assignedAgentId: view?.unassigned
      ? 'unassigned'
      : view?.mine
        ? user?.id
        : filters.assignedAgentId || undefined,
    slaBreached: view?.slaBreached,
  };

  const members = useApiQuery<OrganizationMembersResponse>({
    queryKey: queryKeys.organizations.members(organizationId),
    path: `/api/organizations/${organizationId}/members`,
  });

  const list = useApiQuery<TicketListResponse>({
    queryKey: queryKeys.tickets.list(organizationId, listParams),
    path: `/api/organizations/${organizationId}/tickets`,
    params: {
      ...listParams,
      slaBreached: listParams.slaBreached === undefined ? undefined : listParams.slaBreached ? 'true' : 'false',
    },
  });

  const detail = useApiQuery<TicketResponse>({
    queryKey: queryKeys.tickets.detail(organizationId, ticketId ?? ''),
    path: `/api/organizations/${organizationId}/tickets/${ticketId ?? ''}`,
    enabled: Boolean(ticketId),
  });

  const notes = useApiQuery<TicketNoteListResponse>({
    queryKey: queryKeys.tickets.notes(organizationId, ticketId ?? ''),
    path: `/api/organizations/${organizationId}/tickets/${ticketId ?? ''}/notes`,
    params: { page: 1, pageSize: 50 },
    enabled: Boolean(ticketId),
  });

  const ticketKeys = [queryKeys.tickets.all()];
  const ticket = selectedTicket(ticketId, list.data, detail.data?.ticket);

  const createTicket = useApiMutation({
    mutationFn: (body: CreateTicketRequest) => ticketsApi.create(organizationId, body),
    invalidateKeys: ticketKeys,
    successMessage: 'Ticket created',
  });
  const changeStatus = useApiMutation({
    mutationFn: (status: Exclude<TicketStatus, 'escalated'>) =>
      ticketsApi.changeStatus(organizationId, ticketId ?? '', { status }),
    invalidateKeys: ticketKeys,
    successMessage: 'Status updated',
  });
  const assign = useApiMutation({
    mutationFn: (assignedAgentId: string) => ticketsApi.assign(organizationId, ticketId ?? '', { assignedAgentId }),
    invalidateKeys: ticketKeys,
    successMessage: 'Ticket assigned',
  });
  const assignAvailable = useApiMutation({
    mutationFn: () => ticketsApi.assignAvailable(organizationId, ticketId ?? ''),
    invalidateKeys: ticketKeys,
    successMessage: 'Assigned to next available agent',
  });
  const unassign = useApiMutation({
    mutationFn: () => ticketsApi.unassign(organizationId, ticketId ?? ''),
    invalidateKeys: ticketKeys,
    successMessage: 'Ticket unassigned',
  });
  const escalate = useApiMutation({
    mutationFn: (reason?: string) => ticketsApi.escalate(organizationId, ticketId ?? '', { reason }),
    invalidateKeys: ticketKeys,
    successMessage: 'Ticket escalated',
  });
  const addNote = useApiMutation({
    mutationFn: (body: string) => ticketsApi.addNote(organizationId, ticketId ?? '', { body }),
    invalidateKeys: [queryKeys.tickets.notes(organizationId, ticketId ?? '')],
    successMessage: 'Comment added',
  });
  const upload = useApiMutation({
    mutationFn: (file: File) => ticketsApi.uploadAttachment(organizationId, ticketId ?? '', file),
    successMessage: 'Attachment uploaded',
  });

  const memberItems = useMemo(() => members.data?.members ?? [], [members.data?.members]);
  const assignmentOptions = useMemo(
    () => [
      { value: 'unassigned', label: 'Unassigned' },
      ...(user ? [{ value: user.id, label: 'Assigned to me' }] : []),
      ...memberItems
        .filter(
          (member) =>
            member.status === 'active' &&
            (member.role === 'owner' || member.role === 'admin' || member.role === 'agent'),
        )
        .map((member) => ({ value: member.userId, label: member.displayName })),
    ],
    [memberItems, user],
  );

  const pending =
    changeStatus.isPending ||
    assign.isPending ||
    assignAvailable.isPending ||
    unassign.isPending ||
    escalate.isPending;

  function patchFilters(patch: Partial<TicketQueueFilters>): void {
    const next = new URLSearchParams(searchParams);
    const merged = { ...filters, ...patch };
    writeFilters(next, merged);
    next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function selectTicket(id: string): void {
    setDetailsOpen(false);
    navigate({
      pathname: workspacePath(organizationId, `tickets/${id}`),
      search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    });
  }

  function clearSelection(): void {
    setDetailsOpen(false);
    navigate({
      pathname: workspacePath(organizationId, 'tickets'),
      search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    });
  }

  const details = ticket ? (
    <TicketDetails
      attachments={sessionAttachments[ticket.id] ?? []}
      canManage
      members={memberItems}
      notes={notes.data}
      notesError={notes.error?.message}
      notesPending={notes.isPending}
      onAddNote={async (body) => {
        await addNote.mutateAsync(body);
      }}
      onAssign={(assignedAgentId) => {
        assign.mutate(assignedAgentId);
      }}
      onAssignAvailable={() => {
        assignAvailable.mutate();
      }}
      onDownload={(attachment) => {
        void ticketsApi.downloadAttachment(organizationId, ticket.id, attachment.id, attachment.fileName);
      }}
      onEscalate={(reason) => {
        escalate.mutate(reason);
      }}
      onRetryNotes={() => {
        void notes.refetch();
      }}
      onStatusChange={(status) => {
        changeStatus.mutate(status);
      }}
      onUnassign={() => {
        unassign.mutate();
      }}
      onUpload={async (file) => {
        const result = await upload.mutateAsync(file);
        setSessionAttachments((current) => ({
          ...current,
          [ticket.id]: [...(current[ticket.id] ?? []), result.attachment],
        }));
      }}
      organizationId={organizationId}
      pending={pending}
      ticket={ticket}
    />
  ) : null;

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'flex w-full shrink-0 flex-col border-r border-border md:w-80 lg:w-96',
            ticketId ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Tickets</h1>
              <p className="text-xs text-muted-foreground">Queue, SLA timers, assignment, and comments.</p>
            </div>
            <Button onClick={() => setCreateOpen(true)} size="sm" type="button">
              <Plus />
              New
            </Button>
          </div>
          <TicketFilters
            assignmentOptions={assignmentOptions}
            filters={filters}
            onChange={patchFilters}
            onReset={() => {
              setSearchParams(new URLSearchParams(), { replace: true });
            }}
          />
          <TicketList
            data={list.data}
            errorMessage={list.error?.message}
            isError={list.isError}
            isPending={list.isPending}
            onPageChange={(nextPage) => {
              const next = new URLSearchParams(searchParams);
              if (nextPage <= 1) {
                next.delete('page');
              } else {
                next.set('page', String(nextPage));
              }
              setSearchParams(next, { replace: true });
            }}
            onRetry={() => {
              void list.refetch();
            }}
            onSelect={selectTicket}
            retryPending={list.isFetching}
            selectedId={ticketId}
          />
        </aside>
        <section className={cn('min-w-0 flex-1 flex-col', ticketId ? 'flex' : 'hidden md:flex')}>
          {ticketId && detail.isError ? (
            <div className="p-6">
              <QueryErrorAlert
                message={detail.error.message}
                onRetry={() => {
                  void detail.refetch();
                }}
                pending={detail.isFetching}
                requestId={detail.error.requestId}
                title="Unable to load ticket"
              />
              <Button className="mt-4" onClick={clearSelection} type="button" variant="outline">
                Back to queue
              </Button>
            </div>
          ) : ticket ? (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
                <Button onClick={clearSelection} size="sm" type="button" variant="ghost">
                  Back
                </Button>
                <Button onClick={() => setDetailsOpen(true)} size="sm" type="button" variant="outline">
                  Details
                </Button>
              </div>
              {details}
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Select a ticket to manage status, SLA, comments, and attachments.
            </div>
          )}
        </section>
      </div>
      <Dialog onOpenChange={setDetailsOpen} open={detailsOpen}>
        <DialogContent className="flex h-[min(40rem,90dvh)] max-w-md flex-col overflow-hidden p-0">
          <DialogTitle className="sr-only">Ticket details</DialogTitle>
          {details}
        </DialogContent>
      </Dialog>
      <CreateTicketDialog
        members={memberItems}
        onCreate={async (body) => {
          const result = await createTicket.mutateAsync(body);
          selectTicket(result.ticket.id);
        }}
        onOpenChange={setCreateOpen}
        open={createOpen}
        pending={createTicket.isPending}
      />
    </main>
  );
}

function filtersFromSearch(params: URLSearchParams): TicketQueueFilters {
  return {
    q: params.get('q') ?? '',
    view: params.get('view') ?? 'all',
    priority: params.get('priority') ?? '',
    assignedAgentId: params.get('assignedAgentId') ?? '',
  };
}

function writeFilters(params: URLSearchParams, filters: TicketQueueFilters): void {
  const entries: Array<[keyof TicketQueueFilters, string]> = [
    ['q', filters.q],
    ['view', filters.view === 'all' ? '' : filters.view],
    ['priority', filters.priority],
    ['assignedAgentId', filters.assignedAgentId],
  ];
  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
}

function selectedTicket(
  ticketId: string | undefined,
  list: TicketListResponse | undefined,
  detail: TicketDto | undefined,
): TicketDto | undefined {
  if (!ticketId) {
    return undefined;
  }
  return detail ?? list?.items.find((item) => item.id === ticketId);
}
