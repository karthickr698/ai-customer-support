import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function WorkspacePage({
  children,
  className,
  wide = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly wide?: boolean;
}) {
  return (
    <main
      className={cn(
        'mx-auto flex w-full flex-col gap-8 px-4 py-8 lg:px-8 lg:py-10',
        wide ? 'max-w-6xl' : 'max-w-5xl',
        className,
      )}
    >
      {children}
    </main>
  );
}
