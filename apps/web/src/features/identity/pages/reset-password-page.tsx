import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Field } from '@/components/ui/field';
import { identityApi } from '../api';
import { toApiMessage } from '../api-message';
import { AuthAlert } from '../components/auth-alert';
import { AuthFooterLink, AuthForm, AuthLayout } from '../components/auth-layout';
import { GuestOnly } from '../components/guest-only';
import { PasswordInput } from '../components/password-input';
import { PasswordRequirements } from '../components/password-requirements';
import { SubmitButton } from '../components/submit-button';
import { validatePassword, validatePasswordConfirmation } from '../validation';

export function ResetPasswordPage() {
  return (
    <GuestOnly>
      <ResetPasswordForm />
    </GuestOnly>
  );
}

function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = {
      password: validatePassword(password),
      confirmPassword: validatePasswordConfirmation(password, confirmPassword),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirmPassword) {
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      const response = await identityApi.resetPassword({ token, password });
      setMessage(response.message);
    } catch (caught: unknown) {
      setError(toApiMessage(caught, 'Unable to reset password'));
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout description="This reset link is missing a token. Request a new email and try again." title="Reset password">
        <AuthAlert message="Open the link from your email to choose a new password." title="Invalid reset link" />
        <AuthFooterLink label="Request a new link" prompt="" to="/forgot-password" />
      </AuthLayout>
    );
  }

  if (message) {
    return (
      <AuthLayout description="Your password has been updated." title="Password updated">
        <AuthAlert message={message} title="Success" variant="success" />
        <p className="mt-4 text-sm text-muted-foreground">
          <Link className="font-medium text-primary hover:underline" to="/login">
            Sign in with your new password
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout description="Choose a new password for your account." title="Reset password">
      <AuthForm disabled={pending} onSubmit={(event) => void onSubmit(event)}>
        <Field error={fieldErrors.password} id="password" label="New password" required>
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
        <AuthAlert message={error} title="Reset failed" />
        <SubmitButton pending={pending} pendingLabel="Updating…">
          Update password
        </SubmitButton>
      </AuthForm>
    </AuthLayout>
  );
}
