import type { AuthUserDto } from '@ai-customer-support/contracts';
import type { EventBus } from '@ai-customer-support/shared';
import { AuditActions } from '../../domain/audit-actions.js';
import { EmailAddress } from '../../domain/email-address.js';
import { EmailAlreadyRegisteredError } from '../../domain/errors.js';
import { UserRegisteredEvent } from '../../domain/events.js';
import { OneTimeToken } from '../../domain/one-time-token.js';
import { assertPasswordMeetsPolicy } from '../../domain/password-policy.js';
import { User } from '../../domain/user.js';
import { addSeconds, toAuthUserDto, type RequestSecurityContext } from '../dtos.js';
import type { AuditLogPort } from '../ports/audit-log-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { EmailSenderPort } from '../ports/email-sender-port.js';
import type { OneTimeTokenRepository } from '../ports/one-time-token-repository.js';
import type { PasswordHasherPort } from '../ports/password-hasher-port.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { SecureTokenGeneratorPort } from '../ports/secure-token-generator-port.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AUTH_RATE_LIMITS } from '../rate-limits.js';

export type RegisterUserCommand = {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly security: RequestSecurityContext;
};

export class RegisterUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly oneTimeTokens: OneTimeTokenRepository,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenGenerator: SecureTokenGeneratorPort,
    private readonly tokenHasher: TokenHasherPort,
    private readonly emailSender: EmailSenderPort,
    private readonly auditLog: AuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
    private readonly webOrigin: string,
    private readonly emailVerificationTtlSeconds: number,
  ) {}

  async execute(command: RegisterUserCommand): Promise<{ user: AuthUserDto }> {
    await this.rateLimiter.consume(
      `auth:register:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.registerIp.limit,
      AUTH_RATE_LIMITS.registerIp.windowSeconds,
    );

    const email = EmailAddress.parse(command.email);
    assertPasswordMeetsPolicy(command.password);

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new EmailAlreadyRegisteredError();
    }

    const now = this.clock.now();
    const user = User.register({
      email,
      passwordHash: await this.passwordHasher.hash(command.password),
      displayName: command.displayName,
      now,
    });

    await this.users.save(user);

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
      action: AuditActions.USER_REGISTERED,
      ipAddress: command.security.ipAddress,
      userAgent: command.security.userAgent,
      requestId: command.security.requestId,
      occurredAt: now,
    });

    await this.eventBus.publish(
      new UserRegisteredEvent(
        crypto.randomUUID(),
        now,
        user.id,
        user.email.value,
        command.security.correlationId,
      ),
    );

    return { user: toAuthUserDto(user) };
  }
}
