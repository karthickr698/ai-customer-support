export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 80;

export type PasswordRequirements = {
  readonly length: boolean;
  readonly letter: boolean;
  readonly number: boolean;
};

export function passwordRequirements(value: string): PasswordRequirements {
  return {
    length: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    letter: /[A-Za-z]/.test(value),
    number: /[0-9]/.test(value),
  };
}

export function validateEmail(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Email is required';
  }
  if (trimmed.length > 254) {
    return 'Email must be at most 254 characters';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Enter a valid email address';
  }
  return undefined;
}

export function validateDisplayName(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return 'Name is required';
  }
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Name must be at most ${String(DISPLAY_NAME_MAX_LENGTH)} characters`;
  }
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${String(PASSWORD_MIN_LENGTH)} characters`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${String(PASSWORD_MAX_LENGTH)} characters`;
  }
  if (!/[A-Za-z]/.test(value)) {
    return 'Password must include at least one letter';
  }
  if (!/[0-9]/.test(value)) {
    return 'Password must include at least one number';
  }
  return undefined;
}

export function validateLoginPassword(value: string): string | undefined {
  if (value.length === 0) {
    return 'Password is required';
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${String(PASSWORD_MAX_LENGTH)} characters`;
  }
  return undefined;
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | undefined {
  if (confirmation.length === 0) {
    return 'Confirm your password';
  }
  if (password !== confirmation) {
    return 'Passwords do not match';
  }
  return undefined;
}
