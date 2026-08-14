import { InvalidEmailError } from './errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailAddress {
  private constructor(readonly value: string) {}

  static parse(raw: string): EmailAddress {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length === 0 || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }

    return new EmailAddress(normalized);
  }
}
