export interface RateLimiterPort {
  consume(key: string, limit: number, windowSeconds: number): Promise<void>;
}
