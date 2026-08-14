import { Corner, Root, Scrollbar, Thumb, Viewport } from '@radix-ui/react-scroll-area';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function ScrollArea({ className, children, ...props }: ComponentProps<typeof Root>) {
  return (
    <Root className={cn('relative overflow-hidden', className)} {...props}>
      <Viewport className="size-full rounded-[inherit]">{children}</Viewport>
      <ScrollBar />
      <Corner />
    </Root>
  );
}

export function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ComponentProps<typeof Scrollbar>) {
  return (
    <Scrollbar
      orientation={orientation}
      className={cn(
        'flex touch-none transition-colors select-none',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-px',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-px',
        className,
      )}
      {...props}
    >
      <Thumb className="relative flex-1 rounded-full bg-border" />
    </Scrollbar>
  );
}
