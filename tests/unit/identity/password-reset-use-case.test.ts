import { describe, expect, it } from 'vitest';
import { EmailAddress } from '../../../apps/api/src/modules/identity/domain/email-address.ts';
import { User } from '../../../apps/api/src/modules/identity/domain/user.ts';
import { RequestPasswordResetUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/request-password-reset-use-case.ts';
import { ResetPasswordUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/reset-password-use-case.ts';
import {
  FakePasswordHasher,
  FakeTokenHasher,
  FixedClock,
  InMemoryOneTimeTokenRepository,
  InMemoryRateLimiter,
  InMemoryRefreshSessionRepository,
  InMemoryUserRepository,
  RecordingAuditLog,
  RecordingEmailSender,
  RecordingEventBus,
  security,
  SequenceTokenGenerator,
} from './fakes.ts';

const now = new Date('2026-08-14T12:00:00.000Z');

describe('password reset', () => {
  it('resets the password when a valid token is presented', async () => {
    const users = new InMemoryUserRepository();
    const tokens = new InMemoryOneTimeTokenRepository();
    const refreshSessions = new InMemoryRefreshSessionRepository();
    const emails = new RecordingEmailSender();
    const hasher = new FakePasswordHasher();
    const clock = new FixedClock(now);
    const auditLog = new RecordingAuditLog();
    const eventBus = new RecordingEventBus();
    const tokenGenerator = new SequenceTokenGenerator();
    const tokenHasher = new FakeTokenHasher();

    const user = User.register({
      email: EmailAddress.parse('agent@example.com'),
      passwordHash: await hasher.hash('old-password-1'),
      displayName: 'Alex',
      now,
    });
    user.verifyEmail(now);
    await users.save(user);

    const requestReset = new RequestPasswordResetUseCase(
      users,
      tokens,
      tokenGenerator,
      tokenHasher,
      emails,
      auditLog,
      new InMemoryRateLimiter(),
      clock,
      eventBus,
      'http://localhost:5173',
      3600,
    );
    const reset = new ResetPasswordUseCase(
      users,
      tokens,
      refreshSessions,
      hasher,
      tokenHasher,
      auditLog,
      new InMemoryRateLimiter(),
      clock,
      eventBus,
    );

    await requestReset.execute({ email: 'agent@example.com', security });
    expect(emails.messages[0]?.kind).toBe('password_reset');

    await reset.execute({ token: 'token-1', password: 'new-password-9', security });

    const stored = await users.findByEmail(EmailAddress.parse('agent@example.com'));
    expect(stored?.passwordHash).toBe('hash:new-password-9');
  });

  it('does not reveal whether an email exists', async () => {
    const requestReset = new RequestPasswordResetUseCase(
      new InMemoryUserRepository(),
      new InMemoryOneTimeTokenRepository(),
      new SequenceTokenGenerator(),
      new FakeTokenHasher(),
      new RecordingEmailSender(),
      new RecordingAuditLog(),
      new InMemoryRateLimiter(),
      new FixedClock(now),
      new RecordingEventBus(),
      'http://localhost:5173',
      3600,
    );

    await expect(requestReset.execute({ email: 'missing@example.com', security })).resolves.toBeUndefined();
  });
});
