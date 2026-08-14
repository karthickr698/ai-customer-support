import { AuditActions } from '../../domain/audit-actions.js';
import {
  InvalidRefreshTokenError,
  RefreshTokenReuseDetectedError,
  UserNotFoundError,
} from '../../domain/errors.js';
import type { AuthSessionResult, RequestSecurityContext } from '../dtos.js';
import type { IssueAuthSessionService } from '../issue-auth-session-service.js';
import type { AuditLogPort } from '../ports/audit-log-port.js';
import type { ClockPort } from '../ports/clock-port.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { RefreshSessionRepository } from '../ports/refresh-session-repository.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';
import type { UserRepository } from '../ports/user-repository.js';
import { AUTH_RATE_LIMITS } from '../rate-limits.js';

export type RefreshSessionCommand = {
  readonly refreshToken: string;
  readonly security: RequestSecurityContext;
};

export class RefreshSessionUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshSessions: RefreshSessionRepository,
    private readonly tokenHasher: TokenHasherPort,
    private readonly sessions: IssueAuthSessionService,
    private readonly auditLog: AuditLogPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<AuthSessionResult> {
    await this.rateLimiter.consume(
      `auth:refresh:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.refreshIp.limit,
      AUTH_RATE_LIMITS.refreshIp.windowSeconds,
    );

    const now = this.clock.now();
    const current = await this.refreshSessions.findByTokenHash(
      this.tokenHasher.hash(command.refreshToken),
    );

    if (!current) {
      throw new InvalidRefreshTokenError();
    }

    if (current.isRevoked()) {
      await this.refreshSessions.revokeFamily(current.familyId, now);
      await this.auditLog.record({
        actorId: current.userId,
        action: AuditActions.TOKEN_REFRESH_REUSE_DETECTED,
        ipAddress: command.security.ipAddress,
        userAgent: command.security.userAgent,
        requestId: command.security.requestId,
        occurredAt: now,
      });
      throw new RefreshTokenReuseDetectedError();
    }

    if (current.isExpired(now)) {
      current.revoke(now);
      await this.refreshSessions.save(current);
      throw new InvalidRefreshTokenError();
    }

    const user = await this.users.findById(current.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    user.assertCanAuthenticate();

    const next = await this.sessions.issue(user, command.security, 'refresh', current.familyId);
    current.markReplaced(next.refreshSessionId, now);
    await this.refreshSessions.save(current);

    return next;
  }
}
