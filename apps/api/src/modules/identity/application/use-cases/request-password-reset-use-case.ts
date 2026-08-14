import { AuditActions } from '../../domain/audit-actions.js';
import { EmailAddress } from '../../domain/email-address.js';
import { PasswordResetRequestedEvent } from '../../domain/events.js';
import { OneTimeToken } from '../../domain/one-time-token.js';
import type { EventBus } from '@ai-customer-support/shared';
import { addSeconds, type RequestSecurityContext } from '../dtos.js';
import type { AuditLogPort } from '../ports/audit-log-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { EmailSenderPort } from '../ports/email-sender-port.js';
import type { OneTimeTokenRepository } from '../ports/one-time-token-repository.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { SecureTokenGeneratorPort } from '../ports/secure-token-generator-port.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AUTH_RATE_LIMITS } from '../rate-limits.js';

export type RequestPasswordResetCommand = {
  readonly email: string;
  readonly security: RequestSecurityContext;
};

export class RequestPasswordResetUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly oneTimeTokens: OneTimeTokenRepository,
    private readonly tokenGenerator: SecureTokenGeneratorPort,
    private readonly tokenHasher: TokenHasherPort,
    private readonly emailSender: EmailSenderPort,
    private readonly auditLog: AuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly webOrigin: string,
    private readonly passwordResetTtlSeconds: number,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    await this.rateLimiter.consume(
      `auth:password-reset:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.passwordResetIp.limit,
      AUTH_RATE_LIMITS.passwordResetIp.windowSeconds,
    );

    const email = EmailAddress.parse(command.email);

    await this.rateLimiter.consume(
      `auth:password-reset:email:${email.value}`,
      AUTH_RATE_LIMITS.passwordResetEmail.limit,
      AUTH_RATE_LIMITS.passwordResetEmail.windowSeconds,
    );

    const user = await this.users.findByEmail(email);
    if (!user || !user.hasPassword()) {
      return;
    }

    user.assertCanAuthenticate();

    const now = this.clock.now();
    const resetToken = this.tokenGenerator.generate();
    await this.oneTimeTokens.deleteUnusedForUser('password_reset', user.id);
    await this.oneTimeTokens.save(
      OneTimeToken.issue({
        userId: user.id,
        purpose: 'password_reset',
        tokenHash: this.tokenHasher.hash(resetToken),
        expiresAt: addSeconds(now, this.passwordResetTtlSeconds),
        now,
      }),
    );

    await this.emailSender.send({
      kind: 'password_reset',
      to: user.email.value,
      resetUrl: `${this.webOrigin}/reset-password?token=${encodeURIComponent(resetToken)}`,
    });

    await this.auditLog.record({
      actorId: user.id,
      action: AuditActions.PASSWORD_RESET_REQUESTED,
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new PasswordResetRequestedEvent(
        crypto.randomUUID(),
        now,
        user.id,
        command.security.correlationId,
      ),
    );
  }
}
