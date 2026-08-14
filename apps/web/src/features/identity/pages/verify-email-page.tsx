import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/services/api-error';
import { identityApi } from '../api';
import { useAuthStore } from '../auth-store';
import { AuthLayout, FieldError } from '../components/auth-layout';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setPending(true);

    void identityApi
      .verifyEmail({ token })
      .then((response) => {
        if (!cancelled) {
          setUser(response.user);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to verify email');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setUser, token]);

  if (user) {
    return <Navigate replace to="/organizations" />;
  }

  async function resend() {
    setPending(true);
    setError(undefined);

    try {
      const response = await identityApi.resendVerification({ email });
      setMessage(response.message);
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to resend verification');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout description="Confirm your email to finish setting up your account." title="Verify email">
      {pending && token ? <p className="text-sm text-muted-foreground">Verifying…</p> : null}
      <FieldError message={error} />
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="space-y-3">
        <Label htmlFor="email">Email</Label>
        <Input
          autoComplete="email"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
        <Button className="w-full" disabled={pending || email.length === 0} onClick={() => void resend()} type="button">
          Resend verification email
        </Button>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link className="text-primary hover:underline" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
