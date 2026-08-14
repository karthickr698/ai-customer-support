import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

type FieldProps = {
  readonly id?: string;
  readonly label?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
};

export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required ? <span className="ml-0.5 text-destructive">*</span> : null}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className="text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
