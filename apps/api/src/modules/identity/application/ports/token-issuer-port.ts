export type AccessTokenClaims = {
  readonly userId: string;
  readonly email: string;
};

export type IssuedAccessToken = {
  readonly token: string;
  readonly expiresAt: Date;
};

export interface TokenIssuerPort {
  issueAccessToken(claims: AccessTokenClaims): Promise<IssuedAccessToken>;
  verifyAccessToken(token: string): Promise<AccessTokenClaims | null>;
}
