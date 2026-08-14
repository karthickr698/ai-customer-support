import { describe, expect, it } from 'vitest';
import { EmailAddress } from '../../../apps/api/src/modules/identity/domain/email-address.ts';
import {
  EmailNotVerifiedError,
  InvalidCredentialsError,
} from '../../../apps/api/src/modules/identity/domain/errors.ts';
import { User } from '../../../apps/api/src/modules/identity/domain/user.ts';
import { IssueAuthSessionService } from '../../../apps/api/src/modules/identity/application/issue-auth-session-service.ts';
import { LoginWithPasswordUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/login-with-password-use-case.ts';
import {
  FakePasswordHasher,
  FakeTokenHasher,
  FakeTokenIssuer,
  FixedClock,
  InMemoryRateLimiter,
  InMemoryRefreshSessionRepository,
  InMemoryUserRepository,
  RecordingAuditLog,
  RecordingEventBus,
  security,
  SequenceTokenGenerator,
} from './fakes.ts';

const now = new Date('2026-08-14T12:00:00.000Z');

function createLogin() {
  const users = new InMemoryUserRepository();
  const refreshSessions = new InMemoryRefreshSessionRepository();
  const hasher = new FakePasswordHasher();
  const auditLog = new RecordingAuditLog();
  const clock = new FixedClock(now);
  const sessions = new IssueAuthSessionService(
    refreshSessions,
    new FakeTokenIssuer(),
    new SequenceTokenGenerator(),
    new FakeTokenHasher(),
    clock,
    auditLog,
    new RecordingEventBus(),
    { accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800 },
  );
  const useCase = new LoginWithPasswordUseCase(
    users,
    hasher,
    sessions,
    auditLog,
    new InMemoryRateLimiter(),
    clock,
  );

  return { useCase, users, hasher };
}

describe('LoginWithPasswordUseCase', () => {
  it('issues a session for a verified user', async () => {
    const { useCase, users, hasher } = createLogin();
    const user = User.register({
      email: EmailAddress.parse('agent@example.com'),
      passwordHash: await hasher.hash('correct-horse-1'),
      displayName: 'Alex',
      now,
    });
    user.verifyEmail(now);
    await users.save(user);

    const session = await useCase.execute({
      email: 'agent@example.com',
      password: 'correct-horse-1',
      security,
    });

    expect(session.user.email).toBe('agent@example.com');
    expect(session.accessToken).toContain('access:');
    expect(session.refreshToken).toBe('token-1');
  });

  it('rejects unverified users', async () => {
    const { useCase, users, hasher } = createLogin();
    await users.save(
      User.register({
        email: EmailAddress.parse('agent@example.com'),
        passwordHash: await hasher.hash('correct-horse-1'),
        displayName: 'Alex',
        now,
      }),
    );

    await expect(
      useCase.execute({
        email: 'agent@example.com',
        password: 'correct-horse-1',
        security,
      }),
    ).rejects.toBeInstanceOf(EmailNotVerifiedError);
  });

  it('does not reveal whether the email exists', async () => {
    const { useCase } = createLogin();

    await expect(
      useCase.execute({
        email: 'missing@example.com',
        password: 'correct-horse-1',
        security,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
