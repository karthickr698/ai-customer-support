import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function GoogleSignInButton({
  onClick,
  disabled,
  pending,
}: {
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly pending?: boolean;
}) {
  return (
    <Button
      aria-busy={pending}
      className="w-full"
      disabled={disabled || pending}
      onClick={onClick}
      type="button"
      variant="outline"
    >
      {pending ? <Spinner label="Redirecting to Google" /> : null}
      Continue with Google
    </Button>
  );
}
