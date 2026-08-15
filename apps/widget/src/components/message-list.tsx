import { useEffect, useRef } from 'react';
import type { MessageAttachmentDto, MessageDto } from '@ai-customer-support/contracts';
import { MessageBubble } from './message-bubble';
import { TypingIndicator } from './typing-indicator';

export function MessageList({
  greeting,
  messages,
  streamingText,
  typing,
  onFeedback,
  onOpenAttachment,
}: {
  readonly greeting: string;
  readonly messages: readonly MessageDto[];
  readonly streamingText: string;
  readonly typing: boolean;
  readonly onFeedback: (messageId: string, rating: 'helpful' | 'not_helpful') => void;
  readonly onOpenAttachment: (attachment: MessageAttachmentDto) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streamingText, typing]);

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3"
      role="log"
    >
      <MessageBubble
        message={{
          id: 'greeting',
          conversationId: 'greeting',
          authorType: 'ai',
          authorId: null,
          body: greeting,
          attachments: [],
          createdAt: new Date(0).toISOString(),
        }}
        onOpenAttachment={onOpenAttachment}
      />
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onFeedback={onFeedback}
          onOpenAttachment={onOpenAttachment}
        />
      ))}
      {streamingText ? (
        <MessageBubble
          message={{
            id: 'streaming',
            conversationId: 'streaming',
            authorType: 'ai',
            authorId: null,
            body: streamingText,
            attachments: [],
            createdAt: new Date().toISOString(),
          }}
          onOpenAttachment={onOpenAttachment}
          streaming
        />
      ) : null}
      {typing && !streamingText ? <TypingIndicator label="Assistant is typing" /> : null}
      <div ref={endRef} />
    </div>
  );
}
