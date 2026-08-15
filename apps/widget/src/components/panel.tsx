import { MessageSquarePlus, X } from 'lucide-react';
import type { MessageAttachmentDto } from '@ai-customer-support/contracts';
import { useFocusTrap } from '../hooks/use-focus-trap';
import type { WidgetController } from '../hooks/use-widget';
import { Composer } from './composer';
import { IdentifyForm } from './identify-form';
import { MessageList } from './message-list';

export function WidgetPanel({
  widget,
  onClose,
}: {
  readonly widget: WidgetController;
  readonly onClose: () => void;
}) {
  const trapRef = useFocusTrap(widget.open);
  const closed = widget.conversation?.status === 'closed' || widget.conversation?.status === 'escalated';

  return (
    <section
      aria-busy={widget.sending || widget.typing}
      aria-labelledby="acs-widget-title"
      aria-modal="true"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] border border-border bg-background shadow-2xl"
      id="acs-widget-panel"
      ref={trapRef}
      role="dialog"
    >
      <header className="flex items-center gap-2 bg-primary px-3 py-3 text-primary-foreground">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold" id="acs-widget-title">
            {widget.config?.title ?? 'Chat with us'}
          </h1>
          <p className="truncate text-[11px] opacity-80">
            {widget.config?.aiEnabled ? 'Typically replies instantly' : 'Leave a message'}
          </p>
        </div>
        {widget.phase === 'ready' ? (
          <button
            aria-label="Start a new conversation"
            className="inline-flex size-8 items-center justify-center rounded-full hover:bg-black/10"
            onClick={() => {
              void widget.startNewConversation();
            }}
            type="button"
          >
            <MessageSquarePlus className="size-4" />
          </button>
        ) : null}
        <button
          aria-label="Close support chat"
          className="inline-flex size-8 items-center justify-center rounded-full hover:bg-black/10"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </header>

      {widget.phase === 'bootstrapping' ? (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading chat…</p>
      ) : null}

      {widget.phase === 'error' ? (
        <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-red-600" role="alert">
          {widget.error ?? 'The support widget is unavailable.'}
        </p>
      ) : null}

      {widget.phase === 'disabled' ? (
        <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          {widget.config?.offlineMessage ?? 'Support is currently unavailable.'}
        </p>
      ) : null}

      {widget.phase === 'identify' && widget.config ? (
        <IdentifyForm
          email={widget.identifyEmail}
          error={widget.error}
          name={widget.identifyName}
          onEmailChange={widget.setIdentifyEmail}
          onNameChange={widget.setIdentifyName}
          onSubmit={() => {
            void widget.submitIdentify();
          }}
          required
          title={widget.config.title}
        />
      ) : null}

      {widget.phase === 'ready' && widget.config ? (
        <>
          {widget.config.collectEmail && widget.session?.kind === 'anonymous' ? (
            <IdentifyBanner
              email={widget.identifyEmail}
              name={widget.identifyName}
              onEmailChange={widget.setIdentifyEmail}
              onNameChange={widget.setIdentifyName}
              onSubmit={() => {
                void widget.submitIdentify();
              }}
            />
          ) : null}
          <MessageList
            greeting={widget.config.greeting}
            messages={widget.messages}
            onFeedback={(messageId, rating) => {
              void widget.submitFeedback(messageId, rating);
            }}
            onOpenAttachment={(attachment) => {
              void openAttachment(widget, attachment);
            }}
            streamingText={widget.streamingText}
            typing={widget.typing}
          />
          {widget.error ? (
            <p className="px-4 pb-1 text-xs text-red-600" role="alert">
              {widget.error}
            </p>
          ) : null}
          {closed ? (
            <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
              This conversation is closed.
            </p>
          ) : (
            <Composer
              attachmentsEnabled={widget.config.allowAttachments}
              disabled={false}
              files={widget.pendingFiles}
              onChange={widget.setComposer}
              onFiles={widget.addFiles}
              onRemoveFile={widget.removeFile}
              onSend={() => {
                void widget.send();
              }}
              sending={widget.sending}
              value={widget.composer}
            />
          )}
        </>
      ) : null}
    </section>
  );
}

function IdentifyBanner({
  name,
  email,
  onNameChange,
  onEmailChange,
  onSubmit,
}: {
  readonly name: string;
  readonly email: string;
  readonly onNameChange: (value: string) => void;
  readonly onEmailChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-2 border-b border-border bg-muted/50 px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-[11px] text-muted-foreground">Add your email so we can follow up.</p>
      <div className="flex gap-2">
        <input
          aria-label="Name"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
          onChange={(event) => {
            onNameChange(event.target.value);
          }}
          placeholder="Name"
          value={name}
        />
        <input
          aria-label="Email"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs"
          onChange={(event) => {
            onEmailChange(event.target.value);
          }}
          placeholder="Email"
          type="email"
          value={email}
        />
        <button className="h-8 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground" type="submit">
          Save
        </button>
      </div>
    </form>
  );
}

async function openAttachment(
  widget: WidgetController,
  attachment: MessageAttachmentDto,
): Promise<void> {
  const href = await widget.attachmentHref(attachment);
  window.open(href, '_blank', 'noopener,noreferrer');
}
