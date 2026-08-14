import { GoogleOAuthNotConfiguredError } from '../../domain/errors.js';
import type { RequestSecurityContext } from '../dtos.js';
import type { GoogleOAuthPort } from '../ports/google-oauth-port.js';
import type { OAuthStateStorePort } from '../ports/oauth-state-store-port.js';
import type { RateLimiterPort } from '../ports/rate-limiter-port.js';
import type { SecureTokenGeneratorPort } from '../ports/secure-token-generator-port.js';
import type { TokenHasherPort } from '../ports/token-hasher-port.js';
import { AUTH_RATE_LIMITS, OAUTH_STATE_TTL_SECONDS } from '../rate-limits.js';

export type StartGoogleOAuthCommand = {
  readonly security: RequestSecurityContext;
};

export class StartGoogleOAuthUseCase {
  constructor(
    private readonly googleOAuth: GoogleOAuthPort | undefined,
    private readonly oauthStateStore: OAuthStateStorePort,
    private readonly tokenGenerator: SecureTokenGeneratorPort,
    private readonly tokenHasher: TokenHasherPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly redirectUri: string | undefined,
  ) {}

  async execute(command: StartGoogleOAuthCommand): Promise<{ authorizationUrl: string }> {
    await this.rateLimiter.consume(
      `auth:google-start:ip:${command.security.ipAddress}`,
      AUTH_RATE_LIMITS.googleStartIp.limit,
      AUTH_RATE_LIMITS.googleStartIp.windowSeconds,
    );

    if (!this.googleOAuth || !this.redirectUri) {
      throw new GoogleOAuthNotConfiguredError();
    }

    const state = this.tokenGenerator.generate();
    const codeVerifier = this.tokenGenerator.generate();
    await this.oauthStateStore.save(state, { codeVerifier }, OAUTH_STATE_TTL_SECONDS);

    const authorizationUrl = this.googleOAuth.createAuthorizationUrl({
      state,
      codeChallenge: this.tokenHasher.pkceS256Challenge(codeVerifier),
      redirectUri: this.redirectUri,
    });

    return { authorizationUrl: authorizationUrl.toString() };
  }
}
