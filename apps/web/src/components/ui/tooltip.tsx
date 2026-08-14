import { Content, Provider, Root, Trigger } from '@radix-ui/react-tooltip';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const TooltipProvider = Provider;
export const Tooltip = Root;
export const TooltipTrigger = Trigger;

export function TooltipContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof Content>) {
  return (
    <Content
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        className,
      )}
      {...props}
    />
  );
}
