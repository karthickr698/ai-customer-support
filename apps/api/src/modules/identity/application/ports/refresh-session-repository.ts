import type { RefreshSession } from '../../domain/refresh-session.js';
import type { UserId } from '../../domain/user-id.js';

export interface RefreshSessionRepository {
  save(session: RefreshSession): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshSession | null>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  revokeAllForUser(userId: UserId, now: Date): Promise<void>;
}
