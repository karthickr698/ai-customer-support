import { type FormEvent, type KeyboardEvent, useRef } from 'react';
import { Paperclip, SendHorizonal } from 'lucide-react';
import { PendingAttachmentList } from './attachments';
import type { PendingAttachment } from '../hooks/use-widget';

export function Composer({
  value,
  files,
  disabled,
  attachmentsEnabled,
  sending,
  onChange,
  onFiles,
  onRemoveFile,
  onSend,
}: {
  readonly value: string;
  readonly files: readonly PendingAttachment[];
  readonly disabled: boolean;
  readonly attachmentsEnabled: boolean;
  readonly sending: boolean;
  readonly onChange: (value: string) => void;
  readonly onFiles: (files: FileList) => void;
  readonly onRemoveFile: (id: string) => void;
  readonly onSend: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = !disabled && !sending && (value.trim().length > 0 || files.length > 0);

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (canSend) {
      onSend();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  }

  return (
    <form className="border-t border-border bg-background" onSubmit={onSubmit}>
      <PendingAttachmentList files={files} onRemove={onRemoveFile} />
      <div className="flex items-end gap-1 p-2">
        {attachmentsEnabled ? (
          <>
            <input
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
              className="sr-only"
              multiple
              onChange={(event) => {
                if (event.target.files) {
                  onFiles(event.target.files);
                  event.target.value = '';
                }
              }}
              ref={fileRef}
              type="file"
            />
            <button
              aria-label="Attach a file"
              className="mb-1 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              disabled={disabled || sending}
              onClick={() => {
                fileRef.current?.click();
              }}
              type="button"
            >
              <Paperclip className="size-4" />
            </button>
          </>
        ) : null}
        <label className="sr-only" htmlFor="acs-composer">
          Message
        </label>
        <textarea
          aria-label="Message"
          autoComplete="off"
          autoFocus
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm leading-5 placeholder:text-muted-foreground disabled:opacity-60"
          disabled={disabled}
          id="acs-composer"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder="Write a message"
          rows={1}
          value={value}
        />
        <button
          aria-label="Send message"
          className="mb-1 inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          disabled={!canSend}
          type="submit"
        >
          <SendHorizonal className="size-4" />
        </button>
      </div>
    </form>
  );
}
