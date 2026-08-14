import { describe, expect, it } from 'vitest';
import { EmailAddress } from '../../../apps/api/src/modules/identity/domain/email-address.ts';
import { InvalidEmailError, WeakPasswordError } from '../../../apps/api/src/modules/identity/domain/errors.ts';
import { assertPasswordMeetsPolicy } from '../../../apps/api/src/modules/identity/domain/password-policy.ts';
import { User } from '../../../apps/api/src/modules/identity/domain/user.ts';

describe('EmailAddress', () => {
  it('normalizes email addresses', () => {
    expect(EmailAddress.parse('  User@Example.COM ').value).toBe('user@example.com');
  });

  it('rejects invalid emails', () => {
    expect(() => EmailAddress.parse('not-an-email')).toThrow(InvalidEmailError);
  });
});

describe('password policy', () => {
  it('accepts a strong password', () => {
    expect(() => assertPasswordMeetsPolicy('correct-horse-1')).not.toThrow();
  });

  it('rejects short or letter-only passwords', () => {
    expect(() => assertPasswordMeetsPolicy('short1')).toThrow(WeakPasswordError);
    expect(() => assertPasswordMeetsPolicy('letters-only-password')).toThrow(WeakPasswordError);
  });
});

describe('User', () => {
  const now = new Date('2026-08-14T12:00:00.000Z');

  it('registers an unverified password user', () => {
    const user = User.register({
      email: EmailAddress.parse('agent@example.com'),
      passwordHash: 'hash:secret',
      displayName: 'Alex Agent',
      now,
    });

    expect(user.emailVerified).toBe(false);
    expect(user.hasPassword()).toBe(true);
  });

  it('marks Google users as verified', () => {
    const user = User.registerFromGoogle({
      email: EmailAddress.parse('agent@example.com'),
      displayName: 'Alex Agent',
      now,
    });

    expect(user.emailVerified).toBe(true);
    expect(user.hasPassword()).toBe(false);
  });
});
