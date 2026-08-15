import { FileText, X } from 'lucide-react';
import type { MessageAttachmentDto } from '@ai-customer-support/contracts';
import type { PendingAttachment } from '../hooks/use-widget';

export function PendingAttachmentList({
  files,
  onRemove,
}: {
  readonly files: readonly PendingAttachment[];
  readonly onRemove: (id: string) => void;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-2" aria-label="Selected attachments">
      {files.map((item) => (
        <li
          className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs"
          key={item.id}
        >
          <FileText className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.file.name}</span>
          <button
            aria-label={`Remove ${item.file.name}`}
            className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => {
              onRemove(item.id);
            }}
            type="button"
          >
            <X className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MessageAttachments({
  attachments,
  onOpen,
}: {
  readonly attachments: readonly MessageAttachmentDto[];
  readonly onOpen: (attachment: MessageAttachmentDto) => void;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 space-y-1">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <button
            className="inline-flex max-w-full items-center gap-1 rounded-md bg-black/10 px-2 py-1 text-left text-xs underline-offset-2 hover:underline"
            onClick={() => {
              onOpen(attachment);
            }}
            type="button"
          >
            <FileText className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{attachment.fileName}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
