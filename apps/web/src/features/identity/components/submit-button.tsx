import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  disabled,
}: {
  readonly pending: boolean;
  readonly pendingLabel: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
}) {
  return (
    <Button aria-busy={pending} className="w-full" disabled={disabled || pending} type="submit">
      {pending ? (
        <>
          <Spinner label={pendingLabel} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
