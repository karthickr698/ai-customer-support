export interface TokenHasherPort {
  hash(token: string): string;
}

export interface SecureTokenGeneratorPort {
  generate(): string;
}

export interface RateLimiterPort {
  consume(key: string, limit: number, windowSeconds: number): Promise<void>;
}

export type IdentifiedConversationPort = {
  identifySessionConversations(input: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly email: string;
    readonly name: string;
  }): Promise<void>;
};
