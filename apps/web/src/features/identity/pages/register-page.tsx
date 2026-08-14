import { type FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/services/api-error';
import { identityApi } from '../api';
import { useAuthStore } from '../auth-store';
import { AuthFooterLink, AuthForm, AuthLayout, FieldError } from '../components/auth-layout';
import { GoogleSignInButton } from '../components/google-sign-in-button';

export function RegisterPage() {
  const user = useAuthStore((state) => state.user);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (user) {
    return <Navigate replace to="/" />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const response = await identityApi.register({ email, password, displayName });
      setMessage(response.message);
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create your account');
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
      setError(caught instanceof ApiError ? caught.message : 'Google sign-in is unavailable');
      setPending(false);
    }
  }

  return (
    <AuthLayout description="Create an account. We’ll send a verification link to your email." title="Create account">
      <AuthForm onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="displayName">Name</Label>
          <Input
            autoComplete="name"
            id="displayName"
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            autoComplete="new-password"
            id="password"
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <p className="text-xs text-muted-foreground">
            At least 12 characters, including a letter and a number.
          </p>
        </div>
        <FieldError message={error} />
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </AuthForm>
      <div className="my-4 text-center text-xs uppercase tracking-wide text-muted-foreground">or</div>
      <GoogleSignInButton disabled={pending} onClick={() => void onGoogle()} />
      <AuthFooterLink label="Sign in" prompt="Already have an account?" to="/login" />
    </AuthLayout>
  );
}
