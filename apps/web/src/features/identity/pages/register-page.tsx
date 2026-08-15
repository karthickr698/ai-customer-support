import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { identityApi } from '../api';
import { toApiMessage } from '../api-message';
import { AuthAlert } from '../components/auth-alert';
import { AuthFooterLink, AuthForm, AuthLayout } from '../components/auth-layout';
import { GoogleSignInButton } from '../components/google-sign-in-button';
import { GuestOnly } from '../components/guest-only';
import { PasswordInput } from '../components/password-input';
import { PasswordRequirements } from '../components/password-requirements';
import { SubmitButton } from '../components/submit-button';
import { safeNextPath } from '../safe-next-path';
import {
  validateDisplayName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../validation';

export function RegisterPage() {
  return (
    <GuestOnly>
      <RegisterForm />
    </GuestOnly>
  );
}

function RegisterForm() {
  const [searchParams] = useSearchParams();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const next = searchParams.get('next');
  const loginTo = next ? `/login?next=${encodeURIComponent(safeNextPath(next))}` : '/login';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      displayName: validateDisplayName(displayName),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validatePasswordConfirmation(password, confirmPassword),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.displayName || nextErrors.email || nextErrors.password || nextErrors.confirmPassword) {
      return;
    }

    setPending(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const response = await identityApi.register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      setMessage(response.message);
    } catch (caught: unknown) {
      setError(toApiMessage(caught, 'Unable to create your account'));
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

  if (message) {
    return (
      <AuthLayout description="Check your inbox to confirm your email before signing in." title="Verify your email">
        <AuthAlert message={message} title="Account created" variant="success" />
        <p className="mt-4 text-sm text-muted-foreground">
          Didn’t get the email? You can resend it from the{' '}
          <Link className="font-medium text-primary hover:underline" to="/verify-email">
            verification page
          </Link>
          .
        </p>
        <AuthFooterLink label="Sign in" prompt="Already verified?" to={loginTo} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout description="Create an account with your work email. We’ll send a verification link." title="Create account">
      <AuthForm disabled={busy} onSubmit={(event) => void onSubmit(event)}>
        <Field error={fieldErrors.displayName} id="displayName" label="Full name" required>
          <Input
            autoComplete="name"
            id="displayName"
            onChange={(event) => {
              setDisplayName(event.target.value);
              setFieldErrors((current) => ({ ...current, displayName: undefined }));
            }}
            value={displayName}
          />
        </Field>
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
        <Field error={fieldErrors.password} id="password" label="Password" required>
          <PasswordInput
            autoComplete="new-password"
            id="password"
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            value={password}
          />
        </Field>
        <PasswordRequirements value={password} />
        <Field error={fieldErrors.confirmPassword} id="confirmPassword" label="Confirm password" required>
          <PasswordInput
            autoComplete="new-password"
            id="confirmPassword"
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
            }}
            toggleLabelHide="Hide password confirmation"
            toggleLabelShow="Show password confirmation"
            value={confirmPassword}
          />
        </Field>
        <AuthAlert message={error} title="Could not create account" />
        <SubmitButton pending={pending} pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </AuthForm>
      <div className="my-4 text-center text-xs uppercase tracking-wide text-muted-foreground">or</div>
      <GoogleSignInButton disabled={busy} onClick={() => void onGoogle()} pending={googlePending} />
      <AuthFooterLink label="Sign in" prompt="Already have an account?" to={loginTo} />
    </AuthLayout>
  );
}
