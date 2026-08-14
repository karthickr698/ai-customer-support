import { Fallback, Image, Root } from '@radix-ui/react-avatar';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Avatar({ className, ...props }: ComponentProps<typeof Root>) {
  return (
    <Root className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)} {...props} />
  );
}

export function AvatarImage({ className, ...props }: ComponentProps<typeof Image>) {
  return <Image className={cn('aspect-square size-full', className)} {...props} />;
}

export function AvatarFallback({ className, ...props }: ComponentProps<typeof Fallback>) {
  return (
    <Fallback
      className={cn('flex size-full items-center justify-center bg-muted text-xs font-medium', className)}
      {...props}
    />
  );
}
