import type { MessageAttachmentDto, MessageDto } from '@ai-customer-support/contracts';
import { MessageAttachments } from './attachments';
import { FeedbackActions } from './feedback-actions';

export function MessageBubble({
  message,
  streaming,
  onFeedback,
  onOpenAttachment,
}: {
  readonly message: MessageDto;
  readonly streaming?: boolean;
  readonly onFeedback?: (messageId: string, rating: 'helpful' | 'not_helpful') => void;
  readonly onOpenAttachment: (attachment: MessageAttachmentDto) => void;
}) {
  const isCustomer = message.authorType === 'customer';
  const canFeedback = message.authorType === 'ai' || message.authorType === 'agent';

  return (
    <article
      aria-label={isCustomer ? 'Your message' : 'Assistant message'}
      className={isCustomer ? 'ml-8 flex flex-col items-end' : 'mr-8 flex flex-col items-start'}
    >
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
        {authorLabel(message.authorType)}
        {streaming ? ' · typing' : ''}
      </p>
      <div
        className={
          isCustomer
            ? 'max-w-full rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm leading-6 text-primary-foreground'
            : 'max-w-full rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2 text-sm leading-6 shadow-sm'
        }
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <MessageAttachments attachments={message.attachments} onOpen={onOpenAttachment} />
      </div>
      {canFeedback && onFeedback && !streaming ? (
        <FeedbackActions
          feedback={message.feedback}
          onRate={(rating) => {
            onFeedback(message.id, rating);
          }}
        />
      ) : null}
    </article>
  );
}

function authorLabel(authorType: MessageDto['authorType']): string {
  switch (authorType) {
    case 'customer':
      return 'You';
    case 'agent':
      return 'Agent';
    case 'system':
      return 'System';
    default:
      return 'Assistant';
  }
}
