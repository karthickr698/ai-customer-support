import { Anchor, Content, Portal, Root, Trigger } from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Popover = Root;
export const PopoverTrigger = Trigger;
export const PopoverAnchor = Anchor;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Content>) {
  return (
    <Portal>
      <Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[60] w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </Portal>
  );
}
