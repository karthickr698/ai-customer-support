import { Indicator, Item, Root } from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function RadioGroup({ className, ...props }: ComponentProps<typeof Root>) {
  return <Root className={cn('grid gap-2', className)} {...props} />;
}

export function RadioGroupItem({ className, ...props }: ComponentProps<typeof Item>) {
  return (
    <Item
      className={cn(
        'aspect-square size-4 rounded-full border border-primary text-primary shadow-sm',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Indicator className="flex items-center justify-center">
        <Circle className="size-2.5 fill-current text-current" />
      </Indicator>
    </Item>
  );
}
