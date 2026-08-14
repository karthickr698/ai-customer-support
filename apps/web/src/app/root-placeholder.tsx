import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/identity/auth-store';

export function RootPlaceholder() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const logout = useAuthStore((state) => state.logout);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">AI Customer Support</h1>
      {status === 'loading' || status === 'idle' ? (
        <p className="text-sm text-muted-foreground">Checking session…</p>
      ) : user ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>
          </p>
          <Button asChild>
            <Link to="/organizations">Organizations</Link>
          </Button>
          <Button onClick={() => void logout()} type="button" variant="outline">
            Sign out
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/register">Create account</Link>
          </Button>
        </div>
      )}
      {import.meta.env.DEV ? (
        <Link to="/dev/ui" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Open component gallery
        </Link>
      ) : null}
    </main>
  );
}
