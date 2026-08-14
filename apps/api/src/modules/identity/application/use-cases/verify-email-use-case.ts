import { AuditActions } from '../../domain/audit-actions.js';
import { InvalidEmailVerificationTokenError, UserNotFoundError } from '../../domain/errors.js';
import { EmailVerifiedEvent } from '../../domain/events.js';
import type { EventBus } from '@ai-customer-support/shared';
import type { AuthSessionResult, RequestSecurityContext } from '../dtos.js';
import type { IssueAuthSessionService } from '../issue-auth-session-service.js';
import type { AuditLogPort } from '../ports/audit-log-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { OneTimeTokenRepository } from '../ports/one-time-token-repository.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AUTH_RATE_LIMITS } from '../rate-limits.js';

export type VerifyEmailCommand = {
  readonly token: string;
  readonly security: RequestSecurityContext;
};

export class VerifyEmailUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly oneTimeTokens: OneTimeTokenRepository,
    private readonly tokenHasher: TokenHasherPort,
    private readonly sessions: IssueAuthSessionService,
    private readonly auditLog: AuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<AuthSessionResult> {
    await this.rateLimiter.consume(
      `auth:verify:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.verifyIp.limit,
      AUTH_RATE_LIMITS.verifyIp.windowSeconds,
    );

    const now = this.clock.now();
    const verification = await this.oneTimeTokens.findValidByHash(
      'email_verification',
      this.tokenHasher.hash(command.token),
      now,
    );

    if (!verification) {
      throw new InvalidEmailVerificationTokenError();
    }

    const user = await this.users.findById(verification.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    user.assertCanAuthenticate();
    user.verifyEmail(now);
    verification.consume(now);

    await this.users.save(user);
    await this.oneTimeTokens.save(verification);
    await this.oneTimeTokens.deleteUnusedForUser('email_verification', user.id);

    await this.auditLog.record({
      actorId: user.id,
      action: AuditActions.EMAIL_VERIFIED,
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new EmailVerifiedEvent(crypto.randomUUID(), now, user.id, command.security.correlationId),
    );

    return this.sessions.issue(user, command.security, 'email_verification');
  }
}
