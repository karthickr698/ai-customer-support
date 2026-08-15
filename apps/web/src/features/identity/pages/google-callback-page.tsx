import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { identityApi } from '../api';
import { toApiMessage } from '../api-message';
import { useAuthStore } from '../auth-store';
import { AuthAlert } from '../components/auth-alert';
import { AuthLayout } from '../components/auth-layout';
import { SessionLoading } from '../components/session-loading';
import { safeNextPath } from '../safe-next-path';

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') ?? '';
  const oauthError = searchParams.get('error');
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(code.length > 0 && !oauthError);

  useEffect(() => {
    if (oauthError) {
      setError('Google sign-in was cancelled or denied.');
      setPending(false);
      return;
    }

    if (!code) {
      setError('Google sign-in did not return a login code.');
      setPending(false);
      return;
    }

    let cancelled = false;
    setPending(true);

    void identityApi
      .completeGoogle({ code })
      .then((response) => {
        if (!cancelled) {
          setUser(response.user);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(toApiMessage(caught, 'Google sign-in failed'));
          setPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, oauthError, setUser]);

  if (status === 'idle' || status === 'loading') {
    return <SessionLoading />;
  }

  if (user) {
    return <Navigate replace to={safeNextPath(searchParams.get('state') ?? searchParams.get('next'))} />;
  }

  return (
    <AuthLayout description="Finishing Google sign-in." title="Signing you in">
      {pending && !error ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner label="Completing Google sign-in" />
          Please wait…
        </p>
      ) : (
        <>
          <AuthAlert message={error} title="Google sign-in failed" />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" to="/login?error=google">
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
