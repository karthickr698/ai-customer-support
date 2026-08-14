import { describe, expect, it } from 'vitest';
import { EmailAddress } from '../../../apps/api/src/modules/identity/domain/email-address.ts';
import { RefreshTokenReuseDetectedError } from '../../../apps/api/src/modules/identity/domain/errors.ts';
import { User } from '../../../apps/api/src/modules/identity/domain/user.ts';
import { IssueAuthSessionService } from '../../../apps/api/src/modules/identity/application/issue-auth-session-service.ts';
import { RefreshSessionUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/refresh-session-use-case.ts';
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

describe('RefreshSessionUseCase', () => {
  it('rotates a refresh token and rejects reuse of the previous token', async () => {
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
    const useCase = new RefreshSessionUseCase(
      users,
      refreshSessions,
      new FakeTokenHasher(),
      sessions,
      auditLog,
      new InMemoryRateLimiter(),
      clock,
    );

    const user = User.register({
      email: EmailAddress.parse('agent@example.com'),
      passwordHash: await hasher.hash('correct-horse-1'),
      displayName: 'Alex',
      now,
    });
    user.verifyEmail(now);
    await users.save(user);

    const first = await sessions.issue(user, security, 'password');
    const rotated = await useCase.execute({ refreshToken: first.refreshToken, security });

    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    await expect(useCase.execute({ refreshToken: first.refreshToken, security })).rejects.toBeInstanceOf(
      RefreshTokenReuseDetectedError,
    );
  });
});
