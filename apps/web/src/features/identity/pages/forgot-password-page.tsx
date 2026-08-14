import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/services/api-error';
import { identityApi } from '../api';
import { AuthFooterLink, AuthForm, AuthLayout, FieldError } from '../components/auth-layout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    try {
      const response = await identityApi.forgotPassword({ email });
      setMessage(response.message);
    } catch (caught: unknown) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to send a reset link');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout description="We’ll email a reset link if an account exists." title="Forgot password">
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
        <FieldError message={error} />
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <Button className="w-full" disabled={pending} type="submit">
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </AuthForm>
      <AuthFooterLink label="Back to sign in" prompt="" to="/login" />
    </AuthLayout>
  );
}
