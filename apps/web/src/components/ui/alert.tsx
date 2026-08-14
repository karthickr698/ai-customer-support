import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:top-3.5 [&>svg]:left-4 [&>svg]:size-4 [&>svg~*]:pl-7', {
  variants: {
    variant: {
      default: 'border-border bg-background text-foreground',
      info: 'border-primary/20 bg-primary/5 text-foreground [&>svg]:text-primary',
      success: 'border-success/20 bg-success/5 text-foreground [&>svg]:text-success',
      warning: 'border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning',
      destructive: 'border-destructive/30 bg-destructive/5 text-destructive [&>svg]:text-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const alertIcons = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
} as const;

export type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    readonly icon?: boolean;
  };

export function Alert({ className, variant = 'default', icon = true, children, ...props }: AlertProps) {
  const resolvedVariant = variant ?? 'default';
  const Icon = alertIcons[resolvedVariant];

  return (
    <div role="alert" className={cn(alertVariants({ variant: resolvedVariant }), className)} {...props}>
      {icon ? <Icon /> : null}
      {children}
    </div>
  );
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm leading-relaxed text-muted-foreground', className)} {...props} />;
}
