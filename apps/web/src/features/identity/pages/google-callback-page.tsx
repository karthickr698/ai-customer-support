import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/services/api-error';
import { identityApi } from '../api';
import { useAuthStore } from '../auth-store';
import { AuthLayout, FieldError } from '../components/auth-layout';

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code') ?? '';
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!code) {
      setError('Google sign-in did not return a login code.');
      return;
    }

    let cancelled = false;

    void identityApi
      .completeGoogle({ code })
      .then((response) => {
        if (!cancelled) {
          setUser(response.user);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Google sign-in failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, setUser]);

  if (user) {
    return <Navigate replace to="/" />;
  }

  return (
    <AuthLayout description="Finishing Google sign-in." title="Signing you in">
      {error ? <FieldError message={error} /> : <p className="text-sm text-muted-foreground">Please wait…</p>}
    </AuthLayout>
  );
}
