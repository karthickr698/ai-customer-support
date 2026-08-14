import { Button } from '@/components/ui/button';

export function GoogleSignInButton({
  onClick,
  disabled,
}: {
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Button className="w-full" disabled={disabled} onClick={onClick} type="button" variant="outline">
      Continue with Google
    </Button>
  );
}
