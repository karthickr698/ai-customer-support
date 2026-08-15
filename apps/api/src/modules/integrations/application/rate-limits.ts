export const PUBLIC_API_RATE_LIMITS = {
  credential: { limit: 60, windowSeconds: 60 },
  tokenIp: { limit: 20, windowSeconds: 15 * 60 },
  authorizeUser: { limit: 30, windowSeconds: 15 * 60 },
  createApiKey: { limit: 10, windowSeconds: 60 * 60 },
  createWebhook: { limit: 20, windowSeconds: 60 * 60 },
  createOAuthApp: { limit: 10, windowSeconds: 60 * 60 },
} as const;

export const OAUTH_AUTHORIZATION_CODE_TTL_SECONDS = 10 * 60;
export const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;
export const OAUTH_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export {
  WEBHOOK_DISPATCH_BATCH_SIZE,
  WEBHOOK_DISPATCH_INTERVAL_MS,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_BACKOFF_SECONDS,
  WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  webhookRetryDelaySeconds,
} from '../domain/webhook-retry-policy.js';
