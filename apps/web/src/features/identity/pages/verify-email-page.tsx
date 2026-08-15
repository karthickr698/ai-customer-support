import { type FormEvent, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { identityApi } from '../api';
import { toApiMessage } from '../api-message';
import { useAuthStore } from '../auth-store';
import { AuthAlert } from '../components/auth-alert';
import { AuthFooterLink, AuthForm, AuthLayout } from '../components/auth-layout';
import { SubmitButton } from '../components/submit-button';
import { safeNextPath } from '../safe-next-path';
import { validateEmail } from '../validation';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const [verifying, setVerifying] = useState(token.length > 0);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setVerifying(true);
    setError(undefined);

    void identityApi
      .verifyEmail({ token })
      .then((response) => {
        if (!cancelled) {
          setUser(response.user);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(toApiMessage(caught, 'Unable to verify email'));
          setVerifying(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setUser, token]);

  if (user) {
    return <Navigate replace to={safeNextPath(searchParams.get('next'))} />;
  }

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validateEmail(email);
    setEmailError(nextError);
    if (nextError) {
      return;
    }

    setPending(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const response = await identityApi.resendVerification({ email: email.trim() });
      setMessage(response.message);
    } catch (caught: unknown) {
      setError(toApiMessage(caught, 'Unable to resend verification'));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout description="Confirm your email to finish setting up your account." title="Verify email">
      {verifying ? (
        <p className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner label="Verifying email" />
          Verifying your email…
        </p>
      ) : null}
      <AuthAlert message={error} title="Verification failed" />
      <AuthAlert message={message} title="Email sent" variant="success" />
      {!verifying ? (
        <AuthForm disabled={pending} onSubmit={(event) => void resend(event)}>
          <Field
            error={emailError}
            hint="We’ll send a new link if an unverified account exists for this email."
            id="email"
            label="Work email"
            required
          >
            <Input
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              id="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailError(undefined);
              }}
              spellCheck={false}
              type="email"
              value={email}
            />
          </Field>
          <SubmitButton pending={pending} pendingLabel="Sending…">
            Resend verification email
          </SubmitButton>
        </AuthForm>
      ) : null}
      <AuthFooterLink label="Back to sign in" prompt="" to="/login" />
    </AuthLayout>
  );
}
