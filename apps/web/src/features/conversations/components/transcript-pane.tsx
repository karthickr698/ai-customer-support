import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { ConversationDto, MessageAttachmentDto, MessageDto, MessageListResponse } from '@ai-customer-support/contracts';
import { ArrowLeft, Paperclip } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { conversationTitle, formatRelativeTime } from '../format';
import { AUTHOR_LABELS, PRESENCE_LABELS } from '../labels';
import type { ConversationTyping } from '../realtime/use-workspace-realtime';
import { PresenceDot } from './presence-dot';
import { PriorityBadge, StatusBadge } from './conversation-badges';

export function TranscriptPane({
  conversation,
  notFound,
  messages,
  messagesPending,
  canReply,
  canTakeOver,
  currentUserId,
  replyPending,
  takeoverPending,
  typing,
  onBack,
  onOpenDetails,
  onReply,
  onTakeOver,
  onTyping,
  onOpenAttachment,
}: {
  readonly conversation: ConversationDto | undefined;
  readonly notFound?: boolean;
  readonly messages: MessageListResponse | undefined;
  readonly messagesPending: boolean;
  readonly canReply: boolean;
  readonly canTakeOver: boolean;
  readonly currentUserId: string | undefined;
  readonly replyPending: boolean;
  readonly takeoverPending: boolean;
  readonly typing: readonly ConversationTyping[];
  readonly onBack?: () => void;
  readonly onOpenDetails?: () => void;
  readonly onReply: (body: string) => Promise<void>;
  readonly onTakeOver: () => void;
  readonly onTyping: (active: boolean) => void;
  readonly onOpenAttachment: (attachment: MessageAttachmentDto) => void;
}) {
  if (notFound) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          description="This conversation may have been removed or is outside your workspace."
          title="Conversation not found"
        />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          description="Choose a conversation from the inbox to read the transcript and reply."
          title="Select a conversation"
        />
      </div>
    );
  }

  const closed = conversation.status === 'closed';
  const items = messages?.items ?? [];
  const customerTyping = typing.find((item) => item.actorType === 'customer');
  const assignedToMe = Boolean(currentUserId && conversation.assignedAgentId === currentUserId);
  const showTakeOver = canTakeOver && !assignedToMe && conversation.status !== 'closed';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        {onBack ? (
          <Button aria-label="Back to inbox" className="md:hidden" onClick={onBack} size="icon" type="button" variant="ghost">
            <ArrowLeft />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{conversationTitle(conversation)}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {conversation.customerName} · {conversation.customerEmail}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={conversation.status} />
            <PriorityBadge priority={conversation.priority} />
            {conversation.handledBy === 'agent' && conversation.assignedAgent ? (
              <Badge className="gap-1.5" variant="secondary">
                <PresenceDot status={conversation.assignedAgent.presence ?? 'offline'} />
                {conversation.assignedAgent.displayName}
                {conversation.assignedAgent.presence
                  ? ` · ${PRESENCE_LABELS[conversation.assignedAgent.presence]}`
                  : ''}
              </Badge>
            ) : (
              <Badge variant="outline">AI assistant</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showTakeOver ? (
            <Button disabled={takeoverPending} onClick={onTakeOver} size="sm" type="button">
              Take over
            </Button>
          ) : null}
          {onOpenDetails ? (
            <Button className="xl:hidden" onClick={onOpenDetails} size="sm" type="button" variant="outline">
              Details
            </Button>
          ) : null}
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 px-4 py-4">
          {messagesPending && items.length === 0 ? (
            <>
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="ml-auto h-16 w-2/3" />
              <Skeleton className="h-16 w-1/2" />
            </>
          ) : items.length === 0 ? (
            <EmptyState description="Replies from the customer, agents, and AI appear here." title="No messages yet" />
          ) : (
            items.map((message) => (
              <TranscriptMessage
                key={message.id}
                message={message}
                onOpenAttachment={onOpenAttachment}
              />
            ))
          )}
          {customerTyping ? (
            <p className="text-xs text-muted-foreground">{customerTyping.displayName} is typing…</p>
          ) : null}
        </div>
      </ScrollArea>
      <footer className="border-t border-border p-3">
        {closed ? (
          <Alert>
            <AlertDescription>
              This conversation is closed. Reopen it from details to send a reply.
            </AlertDescription>
          </Alert>
        ) : (
          <ReplyComposer canReply={canReply} pending={replyPending} onReply={onReply} onTyping={onTyping} />
        )}
      </footer>
    </div>
  );
}

function TranscriptMessage({
  message,
  onOpenAttachment,
}: {
  readonly message: MessageDto;
  readonly onOpenAttachment: (attachment: MessageAttachmentDto) => void;
}) {
  const isCustomer = message.authorType === 'customer';
  const isAgent = message.authorType === 'agent';

  return (
    <article
      aria-label={`${AUTHOR_LABELS[message.authorType]} message`}
      className={cn('flex flex-col gap-1', isCustomer ? 'items-start' : 'items-end')}
    >
      <p className="text-[11px] font-medium text-muted-foreground">
        {AUTHOR_LABELS[message.authorType]} · {formatRelativeTime(message.createdAt)}
      </p>
      <div
        className={cn(
          'max-w-[min(40rem,90%)] rounded-2xl px-3 py-2 text-sm leading-6',
          isCustomer && 'rounded-bl-sm bg-muted',
          isAgent && 'rounded-br-sm bg-primary text-primary-foreground',
          !isCustomer && !isAgent && 'rounded-br-sm border border-border bg-background',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        {message.attachments.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {message.attachments.map((attachment) => (
              <li key={attachment.id}>
                <button
                  className={cn(
                    'inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline',
                    isAgent ? 'text-primary-foreground' : 'text-foreground',
                  )}
                  onClick={() => {
                    onOpenAttachment(attachment);
                  }}
                  type="button"
                >
                  <Paperclip className="size-3.5" />
                  {attachment.fileName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function ReplyComposer({
  canReply,
  pending,
  onReply,
  onTyping,
}: {
  readonly canReply: boolean;
  readonly pending: boolean;
  readonly onReply: (body: string) => Promise<void>;
  readonly onTyping: (active: boolean) => void;
}) {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingRef = useRef(false);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (typingRef.current) {
        onTyping(false);
      }
    };
  }, [onTyping]);

  function setTyping(active: boolean): void {
    if (typingRef.current === active) {
      return;
    }
    typingRef.current = active;
    onTyping(active);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const next = body.trim();
    if (!next || !canReply) {
      return;
    }
    setTyping(false);
    await onReply(next);
    setBody('');
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => void onSubmit(event)}>
      <Textarea
        disabled={!canReply || pending}
        onBlur={() => {
          setTyping(false);
        }}
        onChange={(event) => {
          const value = event.target.value;
          setBody(value);
          setTyping(value.trim().length > 0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={canReply ? 'Write a reply…' : 'You do not have permission to reply'}
        ref={textareaRef}
        rows={3}
        value={body}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Ctrl or ⌘ + Enter to send</p>
        <Button disabled={!canReply || pending || body.trim() === ''} type="submit">
          Send reply
        </Button>
      </div>
    </form>
  );
}
