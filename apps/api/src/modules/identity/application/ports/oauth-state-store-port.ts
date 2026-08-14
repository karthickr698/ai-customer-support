export type OAuthState = {
  readonly codeVerifier: string;
};

export interface OAuthStateStorePort {
  save(state: string, value: OAuthState, ttlSeconds: number): Promise<void>;
  take(state: string): Promise<OAuthState | null>;
}

export type OAuthLoginCode = {
  readonly userId: string;
};

export interface OAuthLoginCodeStorePort {
  save(code: string, value: OAuthLoginCode, ttlSeconds: number): Promise<void>;
  take(code: string): Promise<OAuthLoginCode | null>;
}
