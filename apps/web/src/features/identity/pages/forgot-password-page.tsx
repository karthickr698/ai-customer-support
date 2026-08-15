import { type FormEvent, useState } from 'react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { identityApi } from '../api';
import { toApiMessage } from '../api-message';
import { AuthAlert } from '../components/auth-alert';
import { AuthFooterLink, AuthForm, AuthLayout } from '../components/auth-layout';
import { GuestOnly } from '../components/guest-only';
import { SubmitButton } from '../components/submit-button';
import { validateEmail } from '../validation';

export function ForgotPasswordPage() {
  return (
    <GuestOnly>
      <ForgotPasswordForm />
    </GuestOnly>
  );
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validateEmail(email);
    setEmailError(nextError);
    if (nextError) {
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      const response = await identityApi.forgotPassword({ email: email.trim() });
      setMessage(response.message);
    } catch (caught: unknown) {
      setError(toApiMessage(caught, 'Unable to send a reset link'));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout description="We’ll email a reset link if an account exists for that address." title="Forgot password">
      {message ? (
        <>
          <AuthAlert message={message} title="Check your email" variant="success" />
          <AuthFooterLink label="Back to sign in" prompt="" to="/login" />
        </>
      ) : (
        <>
          <AuthForm disabled={pending} onSubmit={(event) => void onSubmit(event)}>
            <Field error={emailError} id="email" label="Work email" required>
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
            <AuthAlert message={error} title="Request failed" />
            <SubmitButton pending={pending} pendingLabel="Sending…">
              Send reset link
            </SubmitButton>
          </AuthForm>
          <AuthFooterLink label="Back to sign in" prompt="" to="/login" />
        </>
      )}
    </AuthLayout>
  );
}
