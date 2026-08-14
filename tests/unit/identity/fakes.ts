import type { EventBus } from '@ai-customer-support/shared';
import { EmailAddress } from '../../../apps/api/src/modules/identity/domain/email-address.ts';
import { OAuthAccount } from '../../../apps/api/src/modules/identity/domain/oauth-account.ts';
import {
  OneTimeToken,
  type OneTimeTokenPurpose,
} from '../../../apps/api/src/modules/identity/domain/one-time-token.ts';
import { RefreshSession } from '../../../apps/api/src/modules/identity/domain/refresh-session.ts';
import { User } from '../../../apps/api/src/modules/identity/domain/user.ts';
import type { UserId } from '../../../apps/api/src/modules/identity/domain/user-id.ts';
import type { AuditLogPort, AuditLogRecord } from '../../../apps/api/src/modules/identity/application/ports/audit-log-port.ts';
import type { ClockPort } from '../../../apps/api/src/modules/identity/application/ports/clock-port.ts';
import type {
  AuthEmailMessage,
  EmailSenderPort,
} from '../../../apps/api/src/modules/identity/application/ports/email-sender-port.ts';
import type {
  GoogleOAuthPort,
  GoogleOAuthProfile,
} from '../../../apps/api/src/modules/identity/application/ports/google-oauth-port.ts';
import type { OAuthAccountRepository } from '../../../apps/api/src/modules/identity/application/ports/oauth-account-repository.ts';
import type {
  OAuthLoginCode,
  OAuthLoginCodeStorePort,
  OAuthState,
  OAuthStateStorePort,
} from '../../../apps/api/src/modules/identity/application/ports/oauth-state-store-port.ts';
import type { OneTimeTokenRepository } from '../../../apps/api/src/modules/identity/application/ports/one-time-token-repository.ts';
import type { PasswordHasherPort } from '../../../apps/api/src/modules/identity/application/ports/password-hasher-port.ts';
import type { RateLimiterPort } from '../../../apps/api/src/modules/identity/application/ports/rate-limiter-port.ts';
import type { RefreshSessionRepository } from '../../../apps/api/src/modules/identity/application/ports/refresh-session-repository.ts';
import type { SecureTokenGeneratorPort } from '../../../apps/api/src/modules/identity/application/ports/secure-token-generator-port.ts';
import type { TokenHasherPort } from '../../../apps/api/src/modules/identity/application/ports/token-hasher-port.ts';
import type {
  AccessTokenClaims,
  IssuedAccessToken,
  TokenIssuerPort,
} from '../../../apps/api/src/modules/identity/application/ports/token-issuer-port.ts';
import type { UserRepository } from '../../../apps/api/src/modules/identity/application/ports/user-repository.ts';
import { RateLimitExceededError } from '@ai-customer-support/shared';
import type { DomainEvent } from '@ai-customer-support/shared';

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();

  async findById(id: UserId): Promise<User | null> {
    return this.clone(this.users.get(id) ?? null);
  }

  async findByEmail(email: EmailAddress): Promise<User | null> {
    return this.clone(
      [...this.users.values()].find((user) => user.email.value === email.value) ?? null,
    );
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, User.reconstitute(user.toSnapshot()));
  }

  private clone(user: User | null): User | null {
    return user ? User.reconstitute(user.toSnapshot()) : null;
  }
}

export class InMemoryRefreshSessionRepository implements RefreshSessionRepository {
  readonly sessions = new Map<string, RefreshSession>();

  async save(session: RefreshSession): Promise<void> {
    this.sessions.set(session.tokenHash, RefreshSession.reconstitute(session.toSnapshot()));
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    const session = this.sessions.get(tokenHash);
    return session ? RefreshSession.reconstitute(session.toSnapshot()) : null;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId) {
        session.revoke(now);
        this.sessions.set(session.tokenHash, RefreshSession.reconstitute(session.toSnapshot()));
      }
    }
  }

  async revokeAllForUser(userId: UserId, now: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.revoke(now);
        this.sessions.set(session.tokenHash, RefreshSession.reconstitute(session.toSnapshot()));
      }
    }
  }
}

export class InMemoryOneTimeTokenRepository implements OneTimeTokenRepository {
  readonly tokens: OneTimeToken[] = [];

  async save(token: OneTimeToken): Promise<void> {
    const index = this.tokens.findIndex((item) => item.id === token.id);
    const copy = OneTimeToken.reconstitute(token.toSnapshot());
    if (index >= 0) {
      this.tokens[index] = copy;
      return;
    }
    this.tokens.push(copy);
  }

  async findValidByHash(
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<OneTimeToken | null> {
    const token = this.tokens.find((item) => item.purpose === purpose && item.tokenHash === tokenHash);
    if (!token || !token.isUsable(now)) {
      return null;
    }
    return OneTimeToken.reconstitute(token.toSnapshot());
  }

  async deleteUnusedForUser(purpose: OneTimeTokenPurpose, userId: UserId): Promise<void> {
    for (let i = this.tokens.length - 1; i >= 0; i -= 1) {
      const token = this.tokens[i];
      if (token && token.purpose === purpose && token.userId === userId && token.consumedAt === undefined) {
        this.tokens.splice(i, 1);
      }
    }
  }
}

export class InMemoryOAuthAccountRepository implements OAuthAccountRepository {
  readonly accounts: OAuthAccount[] = [];

  async save(account: OAuthAccount): Promise<void> {
    this.accounts.push(OAuthAccount.reconstitute(account.toSnapshot()));
  }

  async findByGoogleAccountId(providerAccountId: string): Promise<OAuthAccount | null> {
    const account = this.accounts.find((item) => item.providerAccountId === providerAccountId);
    return account ? OAuthAccount.reconstitute(account.toSnapshot()) : null;
  }
}

export class FakePasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return `hash:${plain}`;
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    return hash === `hash:${plain}`;
  }

  dummyHash(): string {
    return 'hash:dummy';
  }
}

export class FakeTokenIssuer implements TokenIssuerPort {
  async issueAccessToken(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    return {
      token: `access:${claims.userId}`,
      expiresAt: new Date(Date.now() + 900_000),
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    if (!token.startsWith('access:')) {
      return null;
    }

    return { userId: token.slice('access:'.length), email: 'user@example.com' };
  }
}

export class SequenceTokenGenerator implements SecureTokenGeneratorPort {
  private count = 0;

  generate(): string {
    this.count += 1;
    return `token-${this.count}`;
  }
}

export class FakeTokenHasher implements TokenHasherPort {
  hash(token: string): string {
    return `sha256:${token}`;
  }

  pkceS256Challenge(verifier: string): string {
    return `challenge:${verifier}`;
  }
}

export class RecordingEmailSender implements EmailSenderPort {
  readonly messages: AuthEmailMessage[] = [];

  async send(message: AuthEmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

export class RecordingAuditLog implements AuditLogPort {
  readonly entries: AuditLogRecord[] = [];

  async record(entry: AuditLogRecord): Promise<void> {
    this.entries.push(entry);
  }
}

export class InMemoryRateLimiter implements RateLimiterPort {
  readonly counts = new Map<string, number>();
  private readonly limits = new Map<string, number>();

  setLimit(key: string, limit: number): void {
    this.limits.set(key, limit);
  }

  async consume(key: string, limit: number, _windowSeconds: number): Promise<void> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    const effective = this.limits.get(key) ?? limit;
    if (next > effective) {
      throw new RateLimitExceededError('Too many requests', 60);
    }
  }
}

export class InMemoryOAuthStateStore implements OAuthStateStorePort {
  private readonly values = new Map<string, OAuthState>();

  async save(state: string, value: OAuthState, _ttlSeconds: number): Promise<void> {
    this.values.set(state, value);
  }

  async take(state: string): Promise<OAuthState | null> {
    const value = this.values.get(state) ?? null;
    this.values.delete(state);
    return value;
  }
}

export class InMemoryOAuthLoginCodeStore implements OAuthLoginCodeStorePort {
  private readonly values = new Map<string, OAuthLoginCode>();

  async save(code: string, value: OAuthLoginCode, _ttlSeconds: number): Promise<void> {
    this.values.set(code, value);
  }

  async take(code: string): Promise<OAuthLoginCode | null> {
    const value = this.values.get(code) ?? null;
    this.values.delete(code);
    return value;
  }
}

export class FixedClock implements ClockPort {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }
}

export class RecordingEventBus implements EventBus {
  readonly events: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }

  subscribe(): void {}
}

export class FakeGoogleOAuth implements GoogleOAuthPort {
  constructor(private readonly profile: GoogleOAuthProfile) {}

  createAuthorizationUrl(): URL {
    return new URL('https://accounts.google.com/o/oauth2/v2/auth?client_id=test');
  }

  async exchangeAuthorizationCode(): Promise<GoogleOAuthProfile> {
    return this.profile;
  }
}

export const security = {
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
  requestId: 'req-1',
  correlationId: 'corr-1',
};
