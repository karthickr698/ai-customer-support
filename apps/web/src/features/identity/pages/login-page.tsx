import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { identityApi } from '../api';
import { toApiMessage } from '../api-message';
import { useAuthStore } from '../auth-store';
import { AuthAlert } from '../components/auth-alert';
import { AuthFooterLink, AuthForm, AuthLayout } from '../components/auth-layout';
import { GoogleSignInButton } from '../components/google-sign-in-button';
import { GuestOnly } from '../components/guest-only';
import { PasswordInput } from '../components/password-input';
import { SubmitButton } from '../components/submit-button';
import { safeNextPath } from '../safe-next-path';
import { validateEmail, validateLoginPassword } from '../validation';

export function LoginPage() {
  return (
    <GuestOnly>
      <LoginForm />
    </GuestOnly>
  );
}

function LoginForm() {
  const setUser = useAuthStore((state) => state.setUser);
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState(googleErrorMessage(searchParams.get('error')));
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const next = searchParams.get('next');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      password: validateLoginPassword(password),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      const response = await identityApi.login({ email: email.trim(), password });
      setUser(response.user);
    } catch (caught: unknown) {
      setError(toApiMessage(caught, 'Unable to sign in'));
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    setGooglePending(true);
    setError(undefined);

    try {
      const response = await identityApi.startGoogle();
      window.location.assign(response.authorizationUrl);
    } catch (caught: unknown) {
      setError(toApiMessage(caught, 'Google sign-in is unavailable'));
      setGooglePending(false);
    }
  }

  const busy = pending || googlePending;
  const registerTo = next ? `/register?next=${encodeURIComponent(safeNextPath(next))}` : '/register';

  return (
    <AuthLayout description="Sign in with your work email or Google." title="Welcome back">
      <AuthForm disabled={busy} onSubmit={(event) => void onSubmit(event)}>
        <Field error={fieldErrors.email} id="email" label="Work email" required>
          <Input
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            id="email"
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            spellCheck={false}
            type="email"
            value={email}
          />
        </Field>
        <Field
          error={fieldErrors.password}
          id="password"
          label="Password"
          required
        >
          <PasswordInput
            autoComplete="current-password"
            id="password"
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            value={password}
          />
        </Field>
        <div className="-mt-2 flex justify-end">
          <Link className="text-xs font-medium text-primary hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <AuthAlert message={error} title="Sign-in failed" />
        <SubmitButton pending={pending} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </AuthForm>
      <div className="my-4 text-center text-xs uppercase tracking-wide text-muted-foreground">or</div>
      <GoogleSignInButton disabled={busy} onClick={() => void onGoogle()} pending={googlePending} />
      <AuthFooterLink label="Create an account" prompt="No account yet?" to={registerTo} />
    </AuthLayout>
  );
}

function googleErrorMessage(error: string | null): string | undefined {
  if (error === 'google') {
    return 'Google sign-in failed. Try again.';
  }

  return undefined;
}
