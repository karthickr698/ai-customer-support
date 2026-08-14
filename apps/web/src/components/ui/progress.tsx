import { Indicator, Root } from '@radix-ui/react-progress';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Progress({ className, value = 0, ...props }: ComponentProps<typeof Root>) {
  return (
    <Root
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      value={value}
      {...props}
    >
      <Indicator
        className="size-full flex-1 bg-primary transition-transform"
        style={{ transform: `translateX(-${String(100 - (value ?? 0))}%)` }}
      />
    </Root>
  );
}
