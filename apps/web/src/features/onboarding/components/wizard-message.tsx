import type { ReactNode } from 'react';
import { Bot } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0];
  if (!first) {
    return 'YO';
  }
  const second = parts[1];
  if (!second) {
    return first.slice(0, 2).toUpperCase();
  }
  return `${first[0] ?? ''}${second[0] ?? ''}`.toUpperCase();
}

export function WizardMessage({
  role,
  name,
  children,
}: {
  readonly role: 'assistant' | 'user';
  readonly name: string;
  readonly children: ReactNode;
}) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <Avatar className="size-8">
        <AvatarFallback className={isUser ? undefined : 'bg-primary text-primary-foreground'}>
          {isUser ? initials(name) : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          'min-w-0 max-w-[min(100%,36rem)] space-y-3 rounded-2xl px-4 py-3 text-sm leading-6',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        <p className={cn('text-[11px] font-medium uppercase tracking-wide', isUser ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          {isUser ? name : 'Setup assistant'}
        </p>
        {children}
      </div>
    </div>
  );
}

export function WizardTyping({ label }: { readonly label: string }) {
  return (
    <WizardMessage name="Setup assistant" role="assistant">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Spinner label={label} />
        {label}
      </span>
    </WizardMessage>
  );
}

export function WizardPanel({ children }: { readonly children: ReactNode }) {
  return <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">{children}</div>;
}
