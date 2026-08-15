import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/identity/auth-store';
import { SessionLoading } from '@/features/identity/components/session-loading';

export function RootPlaceholder() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  if (status === 'loading' || status === 'idle') {
    return <SessionLoading />;
  }

  if (user) {
    return <Navigate replace to="/organizations" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">AI Customer Support</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Sign in to create a workspace, invite your team, and configure the AI assistant for your organization.
      </p>
      <div className="flex items-center gap-3">
        <Button asChild>
          <Link to="/login">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/register">Create account</Link>
        </Button>
      </div>
      {import.meta.env.DEV ? (
        <Link to="/dev/ui" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Open component gallery
        </Link>
      ) : null}
    </main>
  );
}
