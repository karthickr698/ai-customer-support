import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

type ControlAriaProps = {
  readonly id?: string;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
  readonly 'aria-required'?: boolean;
};

type FieldProps = {
  readonly id?: string;
  readonly label?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
};

function mergeDescribedBy(...values: Array<string | undefined>): string | undefined {
  const ids = values.filter((value): value is string => Boolean(value && value.trim()));
  return ids.length > 0 ? ids.join(' ') : undefined;
}

function enhanceControl(children: ReactNode, props: ControlAriaProps): ReactNode {
  if (Children.count(children) !== 1) {
    return children;
  }

  const child = Children.only(children);
  if (!isValidElement<ControlAriaProps>(child)) {
    return children;
  }

  return cloneElement(child as ReactElement<ControlAriaProps>, {
    id: props.id ?? child.props.id,
    'aria-invalid': props['aria-invalid'] ?? child.props['aria-invalid'],
    'aria-required': props['aria-required'] ?? child.props['aria-required'],
    'aria-describedby': mergeDescribedBy(child.props['aria-describedby'], props['aria-describedby']),
  });
}

export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const hintId = hint && id ? `${id}-hint` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
      ) : null}
      {enhanceControl(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
        'aria-describedby': mergeDescribedBy(errorId, hintId),
      })}
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
