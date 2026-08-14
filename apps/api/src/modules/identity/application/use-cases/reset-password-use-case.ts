import { AuditActions } from '../../domain/audit-actions.js';
import { InvalidPasswordResetTokenError, UserNotFoundError } from '../../domain/errors.js';
import { PasswordResetCompletedEvent } from '../../domain/events.js';
import { assertPasswordMeetsPolicy } from '../../domain/password-policy.js';
import type { EventBus } from '@ai-customer-support/shared';
import type { RequestSecurityContext } from '../dtos.js';
import type { AuditLogPort } from '../ports/audit-log-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { OneTimeTokenRepository } from '../ports/one-time-token-repository.js';
import type { PasswordHasherPort } from '../ports/password-hasher-port.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { RefreshSessionRepository } from '../ports/refresh-session-repository.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AUTH_RATE_LIMITS } from '../rate-limits.js';

export type ResetPasswordCommand = {
  readonly token: string;
  readonly password: string;
  readonly security: RequestSecurityContext;
};

export class ResetPasswordUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly oneTimeTokens: OneTimeTokenRepository,
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenHasher: TokenHasherPort,
    private readonly auditLog: AuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    await this.rateLimiter.consume(
      `auth:password-reset:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.passwordResetIp.limit,
      AUTH_RATE_LIMITS.passwordResetIp.windowSeconds,
    );

    assertPasswordMeetsPolicy(command.password);

    const now = this.clock.now();
    const resetToken = await this.oneTimeTokens.findValidByHash(
      'password_reset',
      this.tokenHasher.hash(command.token),
      now,
    );

    if (!resetToken) {
      throw new InvalidPasswordResetTokenError();
    }

    const user = await this.users.findById(resetToken.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    user.assertCanAuthenticate();
    user.replacePassword(await this.passwordHasher.hash(command.password), now);
    resetToken.consume(now);

    await this.users.save(user);
    await this.oneTimeTokens.save(resetToken);
    await this.oneTimeTokens.deleteUnusedForUser('password_reset', user.id);
    await this.refreshSessions.revokeAllForUser(user.id, now);

    await this.auditLog.record({
      actorId: user.id,
      action: AuditActions.PASSWORD_RESET_COMPLETED,
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new PasswordResetCompletedEvent(
        crypto.randomUUID(),
        now,
        user.id,
        command.security.correlationId,
      ),
    );
  }
}
