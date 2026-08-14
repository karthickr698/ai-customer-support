import { WeakPasswordError } from './errors.js';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function assertPasswordMeetsPolicy(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new WeakPasswordError(
      `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
    );
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new WeakPasswordError('Password must include at least one letter and one number');
  }
}
