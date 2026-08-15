import { type FormEvent, useState } from 'react';
import type {
  ConversationDto,
  ConversationNoteDto,
  ConversationNoteListResponse,
  ConversationPriority,
  ConversationStatus,
  OrganizationMemberDto,
} from '@ai-customer-support/contracts';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/features/organizations/format';
import { CHANNEL_LABELS, PRIORITY_OPTIONS, AGENT_STATUS_OPTIONS, TAG_PATTERN } from '../labels';
import { PriorityBadge, StatusBadge } from './conversation-badges';

export function ConversationDetails({
  conversation,
  notes,
  notesPending,
  members,
  canWrite,
  canAssign,
  canEscalate,
  pending,
  onStatusChange,
  onPriorityChange,
  onAssign,
  onUnassign,
  onAssignAvailable,
  onEscalate,
  onAddTag,
  onRemoveTag,
  onAddNote,
}: {
  readonly conversation: ConversationDto;
  readonly notes: ConversationNoteListResponse | undefined;
  readonly notesPending: boolean;
  readonly members: readonly OrganizationMemberDto[];
  readonly canWrite: boolean;
  readonly canAssign: boolean;
  readonly canEscalate: boolean;
  readonly pending: boolean;
  readonly onStatusChange: (status: Exclude<ConversationStatus, 'escalated'>) => void;
  readonly onPriorityChange: (priority: ConversationPriority) => void;
  readonly onAssign: (assignedAgentId: string) => void;
  readonly onUnassign: () => void;
  readonly onAssignAvailable: () => void;
  readonly onEscalate: (reason?: string) => void;
  readonly onAddTag: (name: string) => void;
  readonly onRemoveTag: (name: string) => void;
  readonly onAddNote: (body: string) => Promise<void>;
}) {
  const assignable = members.filter(
    (member) => member.status === 'active' && (member.role === 'owner' || member.role === 'admin' || member.role === 'agent'),
  );
  const canEscalateNow = canEscalate && (conversation.status === 'open' || conversation.status === 'pending');

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 p-4">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Customer</h3>
          <div>
            <p className="text-sm font-medium">{conversation.customerName}</p>
            <p className="text-sm text-muted-foreground">{conversation.customerEmail}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {CHANNEL_LABELS[conversation.channel]} · Opened {formatDateTime(conversation.createdAt)}
          </p>
        </section>

        <Separator />

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Status</h3>
            <StatusBadge status={conversation.status} />
          </div>
          <Label className="sr-only" htmlFor="inbox-status">
            Conversation status
          </Label>
          <Select
            disabled={!canWrite || pending}
            id="inbox-status"
            onValueChange={(value) => {
              if (value && value !== conversation.status) {
                onStatusChange(value as Exclude<ConversationStatus, 'escalated'>);
              }
            }}
            options={AGENT_STATUS_OPTIONS}
            placeholder="Status"
            searchable={false}
            value={conversation.status === 'escalated' ? '' : conversation.status}
          />
          {canEscalateNow ? (
            <EscalateControl disabled={pending} onEscalate={onEscalate} />
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Priority</h3>
            <PriorityBadge priority={conversation.priority} />
          </div>
          <Select
            disabled={!canWrite || pending}
            onValueChange={(value) => {
              if (value && value !== conversation.priority) {
                onPriorityChange(value as ConversationPriority);
              }
            }}
            options={PRIORITY_OPTIONS}
            placeholder="Priority"
            searchable={false}
            value={conversation.priority}
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Assignment</h3>
          <Select
            disabled={!canAssign || pending}
            onValueChange={(value) => {
              if (value === 'unassigned') {
                if (conversation.assignedAgentId) {
                  onUnassign();
                }
                return;
              }
              if (value !== conversation.assignedAgentId) {
                onAssign(value);
              }
            }}
            options={[
              { value: 'unassigned', label: 'Unassigned' },
              ...assignable.map((member) => ({
                value: member.userId,
                label: member.displayName,
                description: member.email,
              })),
            ]}
            placeholder="Assignee"
            searchable
            value={conversation.assignedAgentId ?? 'unassigned'}
          />
          {canAssign ? (
            <Button
              disabled={pending}
              onClick={onAssignAvailable}
              size="sm"
              type="button"
              variant="outline"
            >
              Assign next available
            </Button>
          ) : null}
        </section>

        <Separator />

        <TagEditor
          canWrite={canWrite}
          pending={pending}
          tags={conversation.tags}
          onAdd={onAddTag}
          onRemove={onRemoveTag}
        />

        <Separator />

        <NotesPanel
          canWrite={canWrite}
          members={members}
          notes={notes}
          notesPending={notesPending}
          pending={notesPending || pending}
          onAddNote={onAddNote}
        />
      </div>
    </ScrollArea>
  );
}

function EscalateControl({
  disabled,
  onEscalate,
}: {
  readonly disabled: boolean;
  readonly onEscalate: (reason?: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-2">
      <Textarea
        disabled={disabled}
        onChange={(event) => {
          setReason(event.target.value);
        }}
        placeholder="Escalation reason (optional)"
        rows={2}
        value={reason}
      />
      <Button
        disabled={disabled}
        onClick={() => {
          onEscalate(reason.trim() || undefined);
          setReason('');
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        Escalate
      </Button>
    </div>
  );
}

function TagEditor({
  tags,
  canWrite,
  pending,
  onAdd,
  onRemove,
}: {
  readonly tags: readonly string[];
  readonly canWrite: boolean;
  readonly pending: boolean;
  readonly onAdd: (name: string) => void;
  readonly onRemove: (name: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();

  function submit(): void {
    const name = value.trim().toLowerCase();
    if (!name) {
      return;
    }
    if (!TAG_PATTERN.test(name)) {
      setError('Use lowercase letters, numbers, or hyphens (max 32).');
      return;
    }
    setError(undefined);
    onAdd(name);
    setValue('');
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Tags</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags</p>
        ) : (
          tags.map((tag) => (
            <Badge className="gap-1 pr-1" key={tag} variant="secondary">
              {tag}
              {canWrite ? (
                <button
                  aria-label={`Remove ${tag}`}
                  className="rounded-sm p-0.5 hover:bg-foreground/10"
                  disabled={pending}
                  onClick={() => {
                    onRemove(tag);
                  }}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </Badge>
          ))
        )}
      </div>
      {canWrite ? (
        <div className="space-y-1">
          <Input
            disabled={pending}
            onChange={(event) => {
              setValue(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Add tag"
            value={value}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function NotesPanel({
  notes,
  notesPending,
  members,
  canWrite,
  pending,
  onAddNote,
}: {
  readonly notes: ConversationNoteListResponse | undefined;
  readonly notesPending: boolean;
  readonly members: readonly OrganizationMemberDto[];
  readonly canWrite: boolean;
  readonly pending: boolean;
  readonly onAddNote: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const items = notes?.items ?? [];

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const next = body.trim();
    if (!next) {
      return;
    }
    await onAddNote(next);
    setBody('');
  }

  function authorName(note: ConversationNoteDto): string {
    return members.find((member) => member.userId === note.authorId)?.displayName ?? 'Teammate';
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Internal notes</h3>
      {notesPending && items.length === 0 ? (
        <Skeleton className="h-16 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet. Notes are only visible to the team.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((note) => (
            <li className="rounded-lg border border-border bg-muted/40 p-3" key={note.id}>
              <p className="text-xs font-medium text-muted-foreground">
                {authorName(note)} · {formatDateTime(note.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canWrite ? (
        <form className="space-y-2" onSubmit={(event) => void onSubmit(event)}>
          <Textarea
            disabled={pending}
            onChange={(event) => {
              setBody(event.target.value);
            }}
            placeholder="Add an internal note"
            rows={3}
            value={body}
          />
          <Button disabled={pending || body.trim() === ''} size="sm" type="submit">
            Add note
          </Button>
        </form>
      ) : null}
    </section>
  );
}
