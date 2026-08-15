import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type {
  ConversationDto,
  ConversationListResponse,
  ConversationNoteListResponse,
  ConversationPriority,
  ConversationResponse,
  ConversationStatus,
  MessageAttachmentDto,
  MessageListResponse,
  OrganizationMembersResponse,
} from '@ai-customer-support/contracts';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuthStore } from '@/features/identity/auth-store';
import { RequireWorkspacePermission } from '@/features/organizations/components/require-workspace-permission';
import { hasPermission } from '@/features/organizations/permissions';
import { useWorkspace } from '@/features/organizations/workspace-context';
import { workspacePath } from '@/features/organizations/workspace-paths';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/services/query-keys';
import { conversationsApi } from '../api';
import { ConversationDetails } from '../components/conversation-details';
import { ConversationFilters, type InboxFilters } from '../components/conversation-filters';
import { ConversationList } from '../components/conversation-list';
import { TranscriptPane } from '../components/transcript-pane';

export function InboxPage() {
  return (
    <RequireWorkspacePermission
      description="You need conversation.read to open the support inbox."
      permission="conversation.read"
      title="Inbox is unavailable"
    >
      <InboxWorkspace />
    </RequireWorkspacePermission>
  );
}

function InboxWorkspace() {
  const { organizationId, permissions } = useWorkspace();
  const { conversationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const canWrite = hasPermission(permissions, 'conversation.write');
  const canAssign = hasPermission(permissions, 'conversation.assign');
  const canEscalate = hasPermission(permissions, 'conversation.escalate');

  const filters = filtersFromSearch(searchParams);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const listParams = {
    page,
    pageSize: 20,
    q: filters.q || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    channel: filters.channel || undefined,
    assignedAgentId:
      filters.assignedAgentId === 'me' ? user?.id : filters.assignedAgentId || undefined,
    tag: filters.tag || undefined,
  };

  const members = useApiQuery<OrganizationMembersResponse>({
    queryKey: queryKeys.organizations.members(organizationId),
    path: `/api/organizations/${organizationId}/members`,
  });

  const list = useApiQuery<ConversationListResponse>({
    queryKey: queryKeys.conversations.list(organizationId, listParams),
    path: `/api/organizations/${organizationId}/conversations`,
    params: listParams,
    refetchInterval: 10_000,
  });

  const detail = useApiQuery<ConversationResponse>({
    queryKey: queryKeys.conversations.detail(organizationId, conversationId ?? ''),
    path: `/api/organizations/${organizationId}/conversations/${conversationId ?? ''}`,
    enabled: Boolean(conversationId),
  });

  const messages = useApiQuery<MessageListResponse>({
    queryKey: queryKeys.conversations.messages(organizationId, conversationId ?? ''),
    path: `/api/organizations/${organizationId}/conversations/${conversationId ?? ''}/messages`,
    params: { page: 1, pageSize: 100 },
    enabled: Boolean(conversationId),
    refetchInterval: conversationId ? 8_000 : false,
  });

  const notes = useApiQuery<ConversationNoteListResponse>({
    queryKey: queryKeys.conversations.notes(organizationId, conversationId ?? ''),
    path: `/api/organizations/${organizationId}/conversations/${conversationId ?? ''}/notes`,
    params: { page: 1, pageSize: 50 },
    enabled: Boolean(conversationId),
  });

  const conversationKeys = [queryKeys.conversations.all()];

  const changeStatus = useApiMutation({
    mutationFn: (status: Exclude<ConversationStatus, 'escalated'>) =>
      conversationsApi.changeStatus(organizationId, conversationId ?? '', { status }),
    invalidateKeys: conversationKeys,
    successMessage: 'Status updated',
  });
  const changePriority = useApiMutation({
    mutationFn: (priority: ConversationPriority) =>
      conversationsApi.changePriority(organizationId, conversationId ?? '', { priority }),
    invalidateKeys: conversationKeys,
    successMessage: 'Priority updated',
  });
  const assign = useApiMutation({
    mutationFn: (assignedAgentId: string) =>
      conversationsApi.assign(organizationId, conversationId ?? '', { assignedAgentId }),
    invalidateKeys: conversationKeys,
    successMessage: 'Conversation assigned',
  });
  const unassign = useApiMutation({
    mutationFn: () => conversationsApi.unassign(organizationId, conversationId ?? ''),
    invalidateKeys: conversationKeys,
    successMessage: 'Conversation unassigned',
  });
  const assignAvailable = useApiMutation({
    mutationFn: () => conversationsApi.assignAvailable(organizationId, conversationId ?? ''),
    invalidateKeys: conversationKeys,
    successMessage: 'Assigned to next available agent',
  });
  const escalate = useApiMutation({
    mutationFn: (reason?: string) => conversationsApi.escalate(organizationId, conversationId ?? '', { reason }),
    invalidateKeys: conversationKeys,
    successMessage: 'Conversation escalated',
  });
  const addTag = useApiMutation({
    mutationFn: (name: string) => conversationsApi.addTag(organizationId, conversationId ?? '', { name }),
    invalidateKeys: conversationKeys,
    successMessage: 'Tag added',
  });
  const removeTag = useApiMutation({
    mutationFn: (name: string) => conversationsApi.removeTag(organizationId, conversationId ?? '', name),
    invalidateKeys: conversationKeys,
    successMessage: 'Tag removed',
  });
  const sendMessage = useApiMutation({
    mutationFn: (body: string) =>
      conversationsApi.sendMessage(organizationId, conversationId ?? '', { body, authorType: 'agent' }),
    invalidateKeys: conversationKeys,
    successMessage: 'Reply sent',
  });
  const addNote = useApiMutation({
    mutationFn: (body: string) => conversationsApi.addNote(organizationId, conversationId ?? '', { body }),
    invalidateKeys: conversationKeys,
    successMessage: 'Note added',
  });

  const pending =
    changeStatus.isPending ||
    changePriority.isPending ||
    assign.isPending ||
    unassign.isPending ||
    assignAvailable.isPending ||
    escalate.isPending ||
    addTag.isPending ||
    removeTag.isPending;

  const conversation = selectedConversation(conversationId, list.data, detail.data?.conversation);
  const memberItems = useMemo(() => members.data?.members ?? [], [members.data?.members]);

  const assignmentOptions = useMemo(
    () => [
      { value: 'unassigned', label: 'Unassigned' },
      ...(user ? [{ value: 'me', label: 'Assigned to me' }] : []),
      ...memberItems
        .filter(
          (member) =>
            member.status === 'active' &&
            (member.role === 'owner' || member.role === 'admin' || member.role === 'agent'),
        )
        .map((member) => ({
          value: member.userId,
          label: member.displayName,
          description: member.email,
        })),
    ],
    [memberItems, user],
  );

  function patchFilters(patch: Partial<InboxFilters>): void {
    const next = new URLSearchParams(searchParams);
    const merged = { ...filters, ...patch };
    writeFilters(next, merged);
    next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function resetFilters(): void {
    const next = new URLSearchParams();
    setSearchParams(next, { replace: true });
  }

  function selectConversation(id: string): void {
    setDetailsOpen(false);
    navigate({
      pathname: workspacePath(organizationId, `inbox/${id}`),
      search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    });
  }

  function clearSelection(): void {
    setDetailsOpen(false);
    navigate({
      pathname: workspacePath(organizationId, 'inbox'),
      search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    });
  }

  async function downloadAttachment(attachment: MessageAttachmentDto): Promise<void> {
    if (!conversationId) {
      return;
    }
    await conversationsApi.downloadAttachment(
      organizationId,
      conversationId,
      attachment.id,
      attachment.fileName,
    );
  }

  const details = conversation ? (
    <ConversationDetails
      canAssign={canAssign}
      canEscalate={canEscalate}
      canWrite={canWrite}
      conversation={conversation}
      members={memberItems}
      notes={notes.data}
      notesPending={notes.isPending}
      onAddNote={async (body) => {
        await addNote.mutateAsync(body);
      }}
      onAddTag={(name) => {
        addTag.mutate(name);
      }}
      onAssign={(assignedAgentId) => {
        assign.mutate(assignedAgentId);
      }}
      onAssignAvailable={() => {
        assignAvailable.mutate();
      }}
      onEscalate={(reason) => {
        escalate.mutate(reason);
      }}
      onPriorityChange={(priority) => {
        changePriority.mutate(priority);
      }}
      onRemoveTag={(name) => {
        removeTag.mutate(name);
      }}
      onStatusChange={(status) => {
        changeStatus.mutate(status);
      }}
      onUnassign={() => {
        unassign.mutate();
      }}
      pending={pending}
    />
  ) : null;

  return (
    <main className="flex h-[calc(100dvh-3.25rem)] min-h-0 flex-col bg-background lg:h-screen">
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'flex w-full shrink-0 flex-col border-r border-border md:w-80 lg:w-96',
            conversationId ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="border-b border-border px-4 py-3">
            <h1 className="text-lg font-semibold tracking-tight">Inbox</h1>
            <p className="text-xs text-muted-foreground">Search, filter, and work conversations.</p>
          </div>
          <ConversationFilters
            assignmentOptions={assignmentOptions}
            filters={filters}
            onChange={patchFilters}
            onReset={resetFilters}
          />
          <ConversationList
            data={list.data}
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
            onSelect={selectConversation}
            selectedId={conversationId}
          />
        </aside>
        <section className={cn('min-w-0 flex-1 flex-col', conversationId ? 'flex' : 'hidden md:flex')}>
          <TranscriptPane
            canReply={canWrite}
            conversation={conversation}
            notFound={Boolean(conversationId) && !detail.isPending && !conversation}
            messages={messages.data}
            messagesPending={Boolean(conversationId) && messages.isPending}
            onBack={conversationId ? clearSelection : undefined}
            onOpenAttachment={(attachment) => {
              void downloadAttachment(attachment);
            }}
            onOpenDetails={conversation ? () => setDetailsOpen(true) : undefined}
            onReply={async (body) => {
              await sendMessage.mutateAsync(body);
            }}
            replyPending={sendMessage.isPending}
          />
        </section>
        <aside className="hidden w-80 shrink-0 border-l border-border xl:flex xl:flex-col">
          {details ?? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Select a conversation to manage status, assignment, tags, and notes.
            </div>
          )}
        </aside>
      </div>
      <Dialog onOpenChange={setDetailsOpen} open={detailsOpen}>
        <DialogContent className="flex h-[min(40rem,90dvh)] max-w-md flex-col overflow-hidden p-0">
          <DialogTitle className="sr-only">Conversation details</DialogTitle>
          {details}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function filtersFromSearch(params: URLSearchParams): InboxFilters {
  return {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    priority: params.get('priority') ?? '',
    assignedAgentId: params.get('assignedAgentId') ?? '',
    channel: params.get('channel') ?? '',
    tag: params.get('tag') ?? '',
  };
}

function writeFilters(params: URLSearchParams, filters: InboxFilters): void {
  const entries: Array<[keyof InboxFilters, string]> = [
    ['q', filters.q],
    ['status', filters.status],
    ['priority', filters.priority],
    ['assignedAgentId', filters.assignedAgentId],
    ['channel', filters.channel],
    ['tag', filters.tag],
  ];

  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
}

function selectedConversation(
  conversationId: string | undefined,
  list: ConversationListResponse | undefined,
  detail: ConversationDto | undefined,
): ConversationDto | undefined {
  if (!conversationId) {
    return undefined;
  }
  return detail ?? list?.items.find((item) => item.id === conversationId);
}
