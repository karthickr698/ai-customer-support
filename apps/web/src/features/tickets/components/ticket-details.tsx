import { useState, type FormEvent } from 'react';
import type {
  OrganizationMemberDto,
  TicketAttachmentDto,
  TicketDto,
  TicketNoteListResponse,
  TicketPriority,
  TicketStatus,
} from '@ai-customer-support/contracts';
import { Link } from 'react-router-dom';
import { Paperclip, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { QueryErrorAlert } from '@/components/ui/query-error';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/features/organizations/format';
import { workspacePath } from '@/features/organizations/workspace-paths';
import { TICKET_PRIORITY_OPTIONS, TICKET_SOURCE_LABELS, TICKET_STATUS_OPTIONS } from '../labels';
import { SlaBadge, TicketPriorityBadge, TicketStatusBadge } from './ticket-badges';
import { SlaTimers } from './sla-timer';

export function TicketDetails({
  organizationId,
  ticket,
  members,
  notes,
  notesPending,
  notesError,
  onRetryNotes,
  attachments,
  canManage,
  pending,
  onStatusChange,
  onAssign,
  onAssignAvailable,
  onUnassign,
  onEscalate,
  onAddNote,
  onUpload,
  onDownload,
}: {
  readonly organizationId: string;
  readonly ticket: TicketDto;
  readonly members: readonly OrganizationMemberDto[];
  readonly notes: TicketNoteListResponse | undefined;
  readonly notesPending: boolean;
  readonly notesError?: string;
  readonly onRetryNotes: () => void;
  readonly attachments: readonly TicketAttachmentDto[];
  readonly canManage: boolean;
  readonly pending: boolean;
  readonly onStatusChange: (status: Exclude<TicketStatus, 'escalated'>) => void;
  readonly onAssign: (assignedAgentId: string) => void;
  readonly onAssignAvailable: () => void;
  readonly onUnassign: () => void;
  readonly onEscalate: (reason?: string) => void;
  readonly onAddNote: (body: string) => Promise<void>;
  readonly onUpload: (file: File) => Promise<void>;
  readonly onDownload: (attachment: TicketAttachmentDto) => void;
}) {
  const [note, setNote] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [notePending, setNotePending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);

  const assignOptions = members
    .filter(
      (member) =>
        member.status === 'active' &&
        (member.role === 'owner' || member.role === 'admin' || member.role === 'agent'),
    )
    .map((member) => ({ value: member.userId, label: member.displayName, description: member.email }));

  async function submitNote(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const body = note.trim();
    if (!body) {
      return;
    }
    setNotePending(true);
    try {
      await onAddNote(body);
      setNote('');
    } finally {
      setNotePending(false);
    }
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-6 p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
            <SlaBadge sla={ticket.sla} />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{ticket.subject}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{ticket.description}</p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Customer</dt>
            <dd className="font-medium">{ticket.customerName}</dd>
            <dd className="text-xs text-muted-foreground">{ticket.customerEmail}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Source</dt>
            <dd>{TICKET_SOURCE_LABELS[ticket.source]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Assignee</dt>
            <dd>{ticket.assignedAgent?.displayName ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Updated</dt>
            <dd>{formatDateTime(ticket.updatedAt)}</dd>
          </div>
        </dl>

        {ticket.conversationId ? (
          <Button asChild size="sm" variant="outline">
            <Link to={workspacePath(organizationId, `inbox/${ticket.conversationId}`)}>Open conversation</Link>
          </Button>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">SLA timers</h3>
          <SlaTimers sla={ticket.sla} />
        </div>

        {canManage ? (
          <div className="space-y-3">
            <Field id="ticket-status" label="Status">
              <Select
                disabled={pending}
                onValueChange={(value) => {
                  if (value === 'open' || value === 'pending' || value === 'resolved' || value === 'closed') {
                    onStatusChange(value);
                  }
                }}
                options={TICKET_STATUS_OPTIONS}
                searchable={false}
                value={ticket.status === 'escalated' ? '' : ticket.status}
              />
            </Field>
            <Field id="ticket-priority-readonly" label="Priority">
              <Select disabled options={TICKET_PRIORITY_OPTIONS} searchable={false} value={ticket.priority as TicketPriority} />
            </Field>
            <Field id="ticket-assign" label="Assignment">
              <Select
                disabled={pending}
                onValueChange={(value) => {
                  if (value) {
                    onAssign(value);
                  }
                }}
                options={assignOptions}
                placeholder="Assign an agent"
                searchable
                value={ticket.assignedAgentId ?? ''}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending} onClick={onAssignAvailable} size="sm" type="button" variant="outline">
                Assign available
              </Button>
              <Button disabled={pending || !ticket.assignedAgentId} onClick={onUnassign} size="sm" type="button" variant="outline">
                Unassign
              </Button>
            </div>
            <Field hint="Escalation marks the ticket escalated and applies the configured action." id="ticket-escalate" label="Escalate">
              <Textarea
                onChange={(event) => {
                  setEscalateReason(event.target.value);
                }}
                placeholder="Reason (optional)"
                value={escalateReason}
              />
            </Field>
            <Button
              disabled={pending}
              onClick={() => {
                onEscalate(escalateReason.trim() || undefined);
              }}
              size="sm"
              type="button"
              variant="destructive"
            >
              Escalate ticket
            </Button>
          </div>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Comments</h3>
          {notesPending ? (
            <Skeleton className="h-16 w-full" />
          ) : notesError ? (
            <QueryErrorAlert message={notesError} onRetry={onRetryNotes} title="Unable to load comments" />
          ) : (notes?.items.length ?? 0) === 0 ? (
            <EmptyState description="Internal comments stay on the ticket." title="No comments yet" />
          ) : (
            <ul className="space-y-3">
              {(notes?.items ?? []).map((item) => (
                <li className="rounded-md border border-border p-3" key={item.id}>
                  <p className="text-sm leading-6">{item.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <form className="flex flex-col gap-2" onSubmit={(event) => void submitNote(event)}>
              <Textarea
                aria-label="Add a comment"
                onChange={(event) => {
                  setNote(event.target.value);
                }}
                placeholder="Add an internal comment"
                value={note}
              />
              <Button disabled={notePending || note.trim() === ''} size="sm" type="submit">
                {notePending ? <Spinner label="Sending" /> : <Send className="size-4" />}
                Add comment
              </Button>
            </form>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Attachments</h3>
          {attachments.length === 0 ? (
            <EmptyState
              description="Upload a file to attach it to this ticket. The API returns the file after upload; download uses that attachment id."
              title="No uploads in this session"
            />
          ) : (
            <ul className="space-y-2">
              {attachments.map((attachment) => (
                <li key={attachment.id}>
                  <Button
                    onClick={() => {
                      onDownload(attachment);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Paperclip className="size-4" />
                    {attachment.fileName}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <Field id="ticket-attachment" label="Upload file">
              <Input
                disabled={uploadPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) {
                    return;
                  }
                  setUploadPending(true);
                  void onUpload(file).finally(() => {
                    setUploadPending(false);
                  });
                }}
                type="file"
              />
            </Field>
          ) : null}
        </section>
      </div>
    </ScrollArea>
  );
}
