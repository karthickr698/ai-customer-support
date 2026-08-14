import type { OAuthAccount } from '../../domain/oauth-account.js';

export interface OAuthAccountRepository {
  save(account: OAuthAccount): Promise<void>;
  findByGoogleAccountId(providerAccountId: string): Promise<OAuthAccount | null>;
}
