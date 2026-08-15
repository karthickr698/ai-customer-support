import {
  API_KEY_TOKEN_PREFIX,
  OAUTH_ACCESS_TOKEN_PREFIX,
} from '../../domain/api-version.js';
import { UnauthorizedError } from '../../domain/errors.js';
import type {
  ClockPort,
  DigestHasherPort,
  OAuthGrantRepository,
  OrganizationApiKeyRepository,
} from '../ports.js';

export type PublicApiCredential = {
  readonly kind: 'api_key' | 'oauth_token';
  readonly tenantId: string;
  readonly actorId: string;
  readonly credentialId: string;
  readonly scopes: readonly string[];
};

export class AuthenticateApiCredentialUseCase {
  constructor(
    private readonly apiKeys: OrganizationApiKeyRepository,
    private readonly grants: OAuthGrantRepository,
    private readonly hasher: DigestHasherPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(token: string): Promise<PublicApiCredential> {
    const now = this.clock.now();
    if (token.startsWith(API_KEY_TOKEN_PREFIX)) {
      const apiKey = await this.apiKeys.findByTokenHash(this.hasher.hash(token));
      if (!apiKey || !apiKey.isUsable(now)) {
        throw new UnauthorizedError();
      }
      await this.apiKeys.save(apiKey.markUsed(now));
      return {
        kind: 'api_key',
        tenantId: apiKey.organizationId,
        actorId: apiKey.createdByUserId,
        credentialId: apiKey.id,
        scopes: apiKey.scopes,
      };
    }

    if (token.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
      const grant = await this.grants.findByAccessTokenHash(this.hasher.hash(token));
      if (!grant || !grant.isAccessTokenValid(now)) {
        throw new UnauthorizedError();
      }
      return {
        kind: 'oauth_token',
        tenantId: grant.organizationId,
        actorId: grant.userId,
        credentialId: grant.id,
        scopes: grant.scopes,
      };
    }

    throw new UnauthorizedError();
  }
}
