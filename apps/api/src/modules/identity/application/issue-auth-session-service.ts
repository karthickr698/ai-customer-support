import type { EventBus } from '@ai-customer-support/shared';
import { AuditActions } from '../domain/audit-actions.js';
import { RefreshSession } from '../domain/refresh-session.js';
import type { User } from '../domain/user.js';
import { addSeconds, toAuthUserDto, type AuthSessionResult, type RequestSecurityContext } from './dtos.js';
import type { AuditLogPort } from './ports/audit-log-port.js';
import type { ClockPort } from './ports/clock-port.js';
import type { RefreshSessionRepository } from './ports/refresh-session-repository.js';
import type { SecureTokenGeneratorPort } from './ports/secure-token-generator-port.js';
import type { TokenHasherPort } from './ports/token-hasher-port.js';
import type { TokenIssuerPort } from './ports/token-issuer-port.js';
import { UserLoggedInEvent } from '../domain/events.js';

export type IdentityTokenTtl = {
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
};

export class IssueAuthSessionService {
  constructor(
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly tokenIssuer: TokenIssuerPort,
    private readonly tokenGenerator: SecureTokenGeneratorPort,
    private readonly tokenHasher: TokenHasherPort,
    private readonly clock: ClockPort,
    private readonly auditLog: AuditLogPort,
    private readonly eventBus: EventBus,
    private readonly ttl: IdentityTokenTtl,
  ) {}

  async issue(
    user: User,
    context: RequestSecurityContext,
    method: 'password' | 'google' | 'refresh' | 'email_verification',
    familyId?: string,
  ): Promise<AuthSessionResult> {
    const now = this.clock.now();
    const refreshToken = this.tokenGenerator.generate();
    const session = RefreshSession.issue({
      userId: user.id,
      tokenHash: this.tokenHasher.hash(refreshToken),
      familyId,
      expiresAt: addSeconds(now, this.ttl.refreshTokenTtlSeconds),
      now,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });

    await this.refreshSessions.save(session);

    const access = await this.tokenIssuer.issueAccessToken({
      userId: user.id,
      email: user.email.value,
    });

    if (method === 'password' || method === 'google') {
      await this.auditLog.record({
        actorId: user.id,
        action: method === 'google' ? AuditActions.GOOGLE_LOGIN_SUCCEEDED : AuditActions.LOGIN_SUCCEEDED,
        metadata: { method },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        occurredAt: now,
      });

      await this.eventBus.publish(
        new UserLoggedInEvent(crypto.randomUUID(), now, user.id, method, context.correlationId),
      );
    }

    if (method === 'refresh') {
      await this.auditLog.record({
        actorId: user.id,
        action: AuditActions.TOKEN_REFRESHED,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        occurredAt: now,
      });
    }

    return {
      user: toAuthUserDto(user),
      accessToken: access.token,
      refreshToken,
      refreshSessionId: session.id,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: session.expiresAt,
    };
  }
}
