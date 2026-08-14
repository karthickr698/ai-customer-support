import { describe, expect, it } from 'vitest';
import { EmailAlreadyRegisteredError } from '../../../apps/api/src/modules/identity/domain/errors.ts';
import { RegisterUserUseCase } from '../../../apps/api/src/modules/identity/application/use-cases/register-user-use-case.ts';
import {
  FakePasswordHasher,
  FakeTokenHasher,
  FixedClock,
  InMemoryOneTimeTokenRepository,
  InMemoryRateLimiter,
  InMemoryUserRepository,
  RecordingAuditLog,
  RecordingEmailSender,
  RecordingEventBus,
  security,
  SequenceTokenGenerator,
} from './fakes.ts';

function createUseCase() {
  const users = new InMemoryUserRepository();
  const tokens = new InMemoryOneTimeTokenRepository();
  const emails = new RecordingEmailSender();
  const useCase = new RegisterUserUseCase(
    users,
    tokens,
    new FakePasswordHasher(),
    new SequenceTokenGenerator(),
    new FakeTokenHasher(),
    emails,
    new RecordingAuditLog(),
    new InMemoryRateLimiter(),
    new FixedClock(new Date('2026-08-14T12:00:00.000Z')),
    new RecordingEventBus(),
    'http://localhost:5173',
    86_400,
  );

  return { useCase, users, emails };
}

describe('RegisterUserUseCase', () => {
  it('creates an unverified user and sends a verification email', async () => {
    const { useCase, users, emails } = createUseCase();

    const result = await useCase.execute({
      email: 'Agent@Example.com',
      password: 'correct-horse-1',
      displayName: 'Alex Agent',
      security,
    });

    expect(result.user.email).toBe('agent@example.com');
    expect(result.user.emailVerified).toBe(false);
    expect(users.users.size).toBe(1);
    expect(emails.messages[0]).toMatchObject({ kind: 'email_verification' });
    expect(emails.messages[0]?.kind === 'email_verification' && emails.messages[0].verifyUrl).toContain(
      'token-1',
    );
  });

  it('rejects duplicate emails', async () => {
    const { useCase } = createUseCase();
    const command = {
      email: 'agent@example.com',
      password: 'correct-horse-1',
      displayName: 'Alex Agent',
      security,
    };

    await useCase.execute(command);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });
});
