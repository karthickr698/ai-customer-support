import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { MessageFeedbackDto } from '@ai-customer-support/contracts';

export function FeedbackActions({
  feedback,
  onRate,
}: {
  readonly feedback?: MessageFeedbackDto | null;
  readonly onRate: (rating: 'helpful' | 'not_helpful') => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-1" role="group" aria-label="Was this reply helpful?">
      <FeedbackButton
        active={feedback?.rating === 'helpful'}
        label="Helpful"
        onClick={() => {
          onRate('helpful');
        }}
      >
        <ThumbsUp />
      </FeedbackButton>
      <FeedbackButton
        active={feedback?.rating === 'not_helpful'}
        label="Not helpful"
        onClick={() => {
          onRate('not_helpful');
        }}
      >
        <ThumbsDown />
      </FeedbackButton>
    </div>
  );
}

function FeedbackButton({
  active,
  label,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={
        active
          ? 'inline-flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary'
          : 'inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground'
      }
      onClick={onClick}
      type="button"
    >
      <span className="[&>svg]:size-3.5">{children}</span>
    </button>
  );
}
