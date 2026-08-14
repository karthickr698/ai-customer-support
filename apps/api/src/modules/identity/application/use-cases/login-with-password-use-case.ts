import { AuditActions } from '../../domain/audit-actions.js';
import { EmailAddress } from '../../domain/email-address.js';
import { InvalidCredentialsError } from '../../domain/errors.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { IssueAuthSessionService } from '../issue-auth-session-service.js';
import type { AuditLogPort } from '../ports/audit-log-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { PasswordHasherPort } from '../ports/password-hasher-port.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AUTH_RATE_LIMITS } from '../rate-limits.js';
import type { AuthSessionResult } from '../dtos.js';

export type LoginWithPasswordCommand = {
  readonly email: string;
  readonly password: string;
  readonly security: RequestSecurityContext;
};

export class LoginWithPasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly sessions: IssueAuthSessionService,
    private readonly auditLog: AuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: LoginWithPasswordCommand): Promise<AuthSessionResult> {
    await this.rateLimiter.consume(
      `auth:login:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.loginIp.limit,
      AUTH_RATE_LIMITS.loginIp.windowSeconds,
    );

    const email = EmailAddress.parse(command.email);

    await this.rateLimiter.consume(
      `auth:login:email:${email.value}`,
      AUTH_RATE_LIMITS.loginEmail.limit,
      AUTH_RATE_LIMITS.loginEmail.windowSeconds,
    );

    const user = await this.users.findByEmail(email);
    const passwordHash = user?.passwordHash ?? this.passwordHasher.dummyHash();
    const passwordMatches = await this.passwordHasher.verify(passwordHash, command.password);

    if (!user || !user.hasPassword() || !passwordMatches) {
      await this.auditLog.record({
        action: AuditActions.LOGIN_FAILED,
        metadata: { email: email.value },
        ipAddress: command.security.ipAddress,
        userAgent: command.security.userAgent,
        requestId: command.security.requestId,
        occurredAt: this.clock.now(),
      });
      throw new InvalidCredentialsError();
    }

    user.assertCanAuthenticate();
    user.assertEmailVerified();

    return this.sessions.issue(user, command.security, 'password');
  }
}
