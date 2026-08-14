import { Root, Thumb } from '@radix-ui/react-switch';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: ComponentProps<typeof Root>) {
  return (
    <Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent shadow-sm transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      {...props}
    >
      <Thumb
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        )}
      />
    </Root>
  );
}
