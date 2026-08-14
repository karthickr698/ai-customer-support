import { AuditActions } from '../../domain/audit-actions.js';
import { EmailAddress } from '../../domain/email-address.js';
import { OneTimeToken } from '../../domain/one-time-token.js';
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

export type ResendVerificationCommand = {
  readonly email: string;
  readonly security: RequestSecurityContext;
};

export class ResendVerificationEmailUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly oneTimeTokens: OneTimeTokenRepository,
    private readonly tokenGenerator: SecureTokenGeneratorPort,
    private readonly tokenHasher: TokenHasherPort,
    private readonly emailSender: EmailSenderPort,
    private readonly auditLog: AuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly webOrigin: string,
    private readonly emailVerificationTtlSeconds: number,
  ) {}

  async execute(command: ResendVerificationCommand): Promise<void> {
    await this.rateLimiter.consume(
      `auth:resend-verification:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.resendVerificationIp.limit,
      AUTH_RATE_LIMITS.resendVerificationIp.windowSeconds,
    );

    const email = EmailAddress.parse(command.email);

    await this.rateLimiter.consume(
      `auth:resend-verification:email:${email.value}`,
      AUTH_RATE_LIMITS.resendVerificationEmail.limit,
      AUTH_RATE_LIMITS.resendVerificationEmail.windowSeconds,
    );

    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerified || !user.hasPassword()) {
      return;
    }

    user.assertCanAuthenticate();

    const now = this.clock.now();
    const verificationToken = this.tokenGenerator.generate();
    await this.oneTimeTokens.deleteUnusedForUser('email_verification', user.id);
    await this.oneTimeTokens.save(
      OneTimeToken.issue({
        userId: user.id,
        purpose: 'email_verification',
        tokenHash: this.tokenHasher.hash(verificationToken),
        expiresAt: addSeconds(now, this.emailVerificationTtlSeconds),
        now,
      }),
    );

    await this.emailSender.send({
      kind: 'email_verification',
      to: user.email.value,
      verifyUrl: `${this.webOrigin}/verify-email?token=${encodeURIComponent(verificationToken)}`,
    });

    await this.auditLog.record({
      actorId: user.id,
      action: AuditActions.EMAIL_VERIFICATION_SENT,
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });
  }
}
