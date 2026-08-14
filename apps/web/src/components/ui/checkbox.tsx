import { Indicator, Root } from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Checkbox({ className, ...props }: ComponentProps<typeof Root>) {
  return (
    <Root
      className={cn(
        'peer size-4 shrink-0 rounded-sm border border-primary shadow-sm',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" />
      </Indicator>
    </Root>
  );
}
