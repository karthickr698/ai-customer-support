import { type FormEvent, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/services/api-error';
import { identityApi } from '../api';
import { useAuthStore } from '../auth-store';
import { AuthFooterLink, AuthForm, AuthLayout, FieldError } from '../components/auth-layout';
import { GoogleSignInButton } from '../components/google-sign-in-button';

export function LoginPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(googleErrorMessage(searchParams.get('error')));
  const [pending, setPending] = useState(false);

  if (user) {
    return <Navigate replace to="/" />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    try {
      const response = await identityApi.login({ email, password });
      setUser(response.user);
    } catch (caught: unknown) {
      setError(toMessage(caught, 'Unable to sign in'));
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    setPending(true);
    setError(undefined);

    try {
      const response = await identityApi.startGoogle();
      window.location.assign(response.authorizationUrl);
    } catch (caught: unknown) {
      setError(toMessage(caught, 'Google sign-in is unavailable'));
      setPending(false);
    }
  }

  return (
    <AuthLayout description="Sign in with your work email or Google." title="Welcome back">
      <AuthForm onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            autoComplete="email"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link className="text-xs text-primary hover:underline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <Input
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <FieldError message={error} />
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </AuthForm>
      <div className="my-4 text-center text-xs uppercase tracking-wide text-muted-foreground">or</div>
      <GoogleSignInButton disabled={pending} onClick={() => void onGoogle()} />
      <AuthFooterLink label="Create an account" prompt="No account yet?" to="/register" />
    </AuthLayout>
  );
}

function googleErrorMessage(error: string | null): string | undefined {
  if (error === 'google') {
    return 'Google sign-in failed. Try again.';
  }

  return undefined;
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
