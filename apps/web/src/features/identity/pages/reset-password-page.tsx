import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/services/api-error';
import { identityApi } from '../api';
import { AuthForm, AuthLayout, FieldError } from '../components/auth-layout';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    try {
      const response = await identityApi.resetPassword({ token, password });
      setMessage(response.message);
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reset password');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout description="Choose a new password for your account." title="Reset password">
      <AuthForm onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            autoComplete="new-password"
            id="password"
            minLength={12}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <FieldError message={error} />
        {message ? (
          <p className="text-sm text-muted-foreground">
            {message}{' '}
            <Link className="text-primary hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        ) : null}
        <Button className="w-full" disabled={pending || token.length === 0} type="submit">
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </AuthForm>
    </AuthLayout>
  );
}
