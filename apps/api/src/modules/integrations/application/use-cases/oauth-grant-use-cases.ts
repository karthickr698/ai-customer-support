import type {
  ApproveOAuthAuthorizationResponse,
  OAuthAuthorizationConsentResponse,
  OAuthTokenResponse,
} from '@ai-customer-support/contracts';
import {
  OAUTH_ACCESS_TOKEN_PREFIX,
  OAUTH_AUTHORIZATION_CODE_PREFIX,
  OAUTH_REFRESH_TOKEN_PREFIX,
} from '../../domain/api-version.js';
import { parseScopeQuery } from '../../domain/api-scopes.js';
import {
  InvalidOAuthApplicationError,
  InvalidOAuthGrantError,
  OAuthApplicationNotFoundError,
  OAuthAuthorizationDeniedError,
} from '../../domain/errors.js';
import { OrganizationOAuthGrant } from '../../domain/oauth-grant.js';
import {
  OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  OAUTH_AUTHORIZATION_CODE_TTL_SECONDS,
  OAUTH_REFRESH_TOKEN_TTL_SECONDS,
  PUBLIC_API_RATE_LIMITS,
} from '../rate-limits.js';
import type {
  ClockPort,
  DigestHasherPort,
  OAuthApplicationRepository,
  OAuthGrantRepository,
  RateLimiterPort,
  SecureTokenGeneratorPort,
  TenantAccessPort,
  TokenHasherPort,
} from '../ports.js';

export class DescribeOAuthAuthorizationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly applications: OAuthApplicationRepository,
    private readonly rateLimiter: RateLimiterPort,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly clientId: string;
    readonly redirectUri: string;
    readonly state: string;
    readonly codeChallenge: string;
    readonly scope?: string;
  }): Promise<OAuthAuthorizationConsentResponse> {
    await this.rateLimiter.consume(
      `integrations:oauth-authorize:${input.actorId}`,
      PUBLIC_API_RATE_LIMITS.authorizeUser.limit,
      PUBLIC_API_RATE_LIMITS.authorizeUser.windowSeconds,
    );
    const application = await requireActiveApplication(this.applications, input.clientId);
    await this.tenantAccess.loadActor(application.organizationId, input.actorId);
    if (!application.allowsRedirect(input.redirectUri)) {
      throw new InvalidOAuthApplicationError('Redirect URI is not registered for this application');
    }
    if (input.codeChallenge.trim().length < 16) {
      throw new InvalidOAuthGrantError('PKCE code challenge is required');
    }
    const scopes = parseScopeQuery(input.scope, application.scopes);
    return {
      application: {
        id: application.id,
        name: application.name,
        organizationId: application.organizationId,
      },
      redirectUri: input.redirectUri,
      scopes,
      state: input.state,
    };
  }
}

export class ApproveOAuthAuthorizationUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly applications: OAuthApplicationRepository,
    private readonly grants: OAuthGrantRepository,
    private readonly tokens: SecureTokenGeneratorPort,
    private readonly hasher: DigestHasherPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly actorId: string;
    readonly clientId: string;
    readonly redirectUri: string;
    readonly state: string;
    readonly codeChallenge: string;
    readonly scope?: string;
    readonly approve?: boolean;
  }): Promise<ApproveOAuthAuthorizationResponse> {
    if (input.approve === false) {
      throw new OAuthAuthorizationDeniedError();
    }
    const application = await requireActiveApplication(this.applications, input.clientId);
    await this.tenantAccess.loadActor(application.organizationId, input.actorId);
    if (!application.allowsRedirect(input.redirectUri)) {
      throw new InvalidOAuthApplicationError('Redirect URI is not registered for this application');
    }
    const scopes = parseScopeQuery(input.scope, application.scopes);
    const code = `${OAUTH_AUTHORIZATION_CODE_PREFIX}${this.tokens.generate()}`;
    const grant = OrganizationOAuthGrant.create({
      organizationId: application.organizationId,
      applicationId: application.id,
      userId: input.actorId,
      codeHash: this.hasher.hash(code),
      codeChallenge: input.codeChallenge,
      redirectUri: input.redirectUri,
      scopes,
      now: this.clock.now(),
    });
    await this.grants.save(grant);
    const redirectUrl = new URL(input.redirectUri);
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('state', input.state);
    return { redirectUrl: redirectUrl.toString() };
  }
}

export class ExchangeOAuthTokenUseCase {
  constructor(
    private readonly applications: OAuthApplicationRepository,
    private readonly grants: OAuthGrantRepository,
    private readonly tokens: SecureTokenGeneratorPort,
    private readonly hasher: DigestHasherPort,
    private readonly pkce: TokenHasherPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly clock: ClockPort,
    private readonly accessTtlSeconds: number = OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    private readonly refreshTtlSeconds: number = OAUTH_REFRESH_TOKEN_TTL_SECONDS,
    private readonly codeTtlSeconds: number = OAUTH_AUTHORIZATION_CODE_TTL_SECONDS,
  ) {}

  async execute(input: {
    readonly grantType: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly code?: string;
    readonly codeVerifier?: string;
    readonly redirectUri?: string;
    readonly refreshToken?: string;
    readonly ipAddress: string;
  }): Promise<OAuthTokenResponse> {
    await this.rateLimiter.consume(
      `integrations:oauth-token:${input.ipAddress}`,
      PUBLIC_API_RATE_LIMITS.tokenIp.limit,
      PUBLIC_API_RATE_LIMITS.tokenIp.windowSeconds,
    );
    const application = await requireActiveApplication(this.applications, input.clientId);
    if (!application.verifyClientSecret(this.hasher.hash(input.clientSecret))) {
      throw new InvalidOAuthGrantError('Client authentication failed');
    }

    if (input.grantType === 'authorization_code') {
      return this.exchangeCode(application.organizationId, input);
    }
    if (input.grantType === 'refresh_token') {
      return this.refresh(input);
    }
    throw new InvalidOAuthGrantError('Unsupported grant type');
  }

  private async exchangeCode(
    tenantId: string,
    input: {
      readonly code?: string;
      readonly codeVerifier?: string;
      readonly redirectUri?: string;
    },
  ): Promise<OAuthTokenResponse> {
    if (!input.code || !input.codeVerifier || !input.redirectUri) {
      throw new InvalidOAuthGrantError('code, codeVerifier, and redirectUri are required');
    }
    const grant = await this.grants.findByCodeHash(this.hasher.hash(input.code));
    if (!grant || grant.organizationId !== tenantId || !grant.isCodeRedeemable(this.clock.now(), this.codeTtlSeconds)) {
      throw new InvalidOAuthGrantError();
    }
    if (grant.redirectUri !== input.redirectUri) {
      throw new InvalidOAuthGrantError('Redirect URI does not match the authorization request');
    }
    if (!grant.matchesPkce(this.pkce.pkceS256Challenge(input.codeVerifier))) {
      throw new InvalidOAuthGrantError('PKCE verification failed');
    }
    return this.issueTokens(grant);
  }

  private async refresh(input: { readonly refreshToken?: string }): Promise<OAuthTokenResponse> {
    if (!input.refreshToken) {
      throw new InvalidOAuthGrantError('refreshToken is required');
    }
    const grant = await this.grants.findByRefreshTokenHash(this.hasher.hash(input.refreshToken));
    if (!grant || !grant.isRefreshTokenValid(this.clock.now())) {
      throw new InvalidOAuthGrantError();
    }
    return this.issueTokens(grant, true);
  }

  private async issueTokens(grant: OrganizationOAuthGrant, rotate = false): Promise<OAuthTokenResponse> {
    const now = this.clock.now();
    const accessToken = `${OAUTH_ACCESS_TOKEN_PREFIX}${this.tokens.generate()}`;
    const refreshToken = `${OAUTH_REFRESH_TOKEN_PREFIX}${this.tokens.generate()}`;
    const accessExpiresAt = new Date(now.getTime() + this.accessTtlSeconds * 1000);
    const refreshExpiresAt = new Date(now.getTime() + this.refreshTtlSeconds * 1000);
    const updated = rotate
      ? grant.rotateTokens({
          accessTokenHash: this.hasher.hash(accessToken),
          refreshTokenHash: this.hasher.hash(refreshToken),
          accessExpiresAt,
          refreshExpiresAt,
        })
      : grant.issueTokens({
          accessTokenHash: this.hasher.hash(accessToken),
          refreshTokenHash: this.hasher.hash(refreshToken),
          accessExpiresAt,
          refreshExpiresAt,
          now,
        });
    await this.grants.save(updated);
    return {
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
      scope: updated.scopes.join(' '),
    };
  }
}

async function requireActiveApplication(
  applications: OAuthApplicationRepository,
  clientId: string,
) {
  const application = await applications.findByClientId(clientId);
  if (!application || !application.isActive) {
    throw new OAuthApplicationNotFoundError();
  }
  return application;
}
