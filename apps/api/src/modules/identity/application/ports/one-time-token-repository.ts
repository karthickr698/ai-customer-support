import type { OneTimeToken, OneTimeTokenPurpose } from '../../domain/one-time-token.js';
import type { UserId } from '../../domain/user-id.js';

export interface OneTimeTokenRepository {
  save(token: OneTimeToken): Promise<void>;
  findValidByHash(
    purpose: OneTimeTokenPurpose,
    tokenHash: string,
    now: Date,
  ): Promise<OneTimeToken | null>;
  deleteUnusedForUser(purpose: OneTimeTokenPurpose, userId: UserId): Promise<void>;
}
