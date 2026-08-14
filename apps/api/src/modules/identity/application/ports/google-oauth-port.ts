export type GoogleOAuthProfile = {
  readonly providerAccountId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string;
};

export type GoogleAuthorizationRequest = {
  readonly state: string;
  readonly codeChallenge: string;
  readonly redirectUri: string;
};

export interface GoogleOAuthPort {
  createAuthorizationUrl(request: GoogleAuthorizationRequest): URL;
  exchangeAuthorizationCode(input: {
    readonly code: string;
    readonly codeVerifier: string;
    readonly redirectUri: string;
  }): Promise<GoogleOAuthProfile>;
}
