import { MessageCircle } from 'lucide-react';
import type { WidgetFormValues } from '../validation';

export function WidgetPreview({ values }: { readonly values: WidgetFormValues }) {
  const foreground = contrastForeground(values.primaryColor || '#2563eb');

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-muted/40 p-4">
      <div className="mx-auto w-full max-w-[320px]">
        <div className="overflow-hidden rounded-[20px] border border-border bg-background shadow-lg">
          <div
            className="flex items-center justify-between px-3 py-3"
            style={{ background: values.primaryColor || '#2563eb', color: foreground }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{values.title || 'Chat with us'}</p>
              <p className="truncate text-[11px] opacity-80">
                {values.aiEnabled ? 'Typically replies instantly' : 'Leave a message'}
              </p>
            </div>
            <span className="text-lg leading-none opacity-80">×</span>
          </div>
          <div className="space-y-3 bg-muted/30 p-3">
            <div className="mr-8">
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Assistant</p>
              <div className="rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2 text-sm leading-6">
                {values.enabled ? values.greeting : values.offlineMessage}
              </div>
            </div>
            <div className="ml-8">
              <p className="mb-1 text-right text-[11px] font-medium text-muted-foreground">You</p>
              <div
                className="rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-6"
                style={{ background: values.primaryColor || '#2563eb', color: foreground }}
              >
                Can you help with my order?
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border p-2">
            <div className="h-8 flex-1 rounded-lg border border-border bg-muted/40 px-2 text-xs leading-8 text-muted-foreground">
              Write a message
            </div>
            <span
              className="inline-flex size-8 items-center justify-center rounded-full text-xs"
              style={{ background: values.primaryColor || '#2563eb', color: foreground }}
            >
              →
            </span>
          </div>
        </div>
        <div className={`mt-3 flex ${values.position === 'left' ? 'justify-start' : 'justify-end'}`}>
          <span
            className="inline-flex size-12 items-center justify-center rounded-full shadow-md"
            style={{ background: values.primaryColor || '#2563eb', color: foreground }}
          >
            <MessageCircle className="size-5" />
            <span className="sr-only">{values.launcherText}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function contrastForeground(hex: string): string {
  const value = hex.trim();
  const normalized =
    value.length === 4 && value[1] && value[2] && value[3]
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const toLinear = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.45 ? '#0f172a' : '#ffffff';
}
