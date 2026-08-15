import { WEBHOOK_EVENT_NAMES } from '@ai-customer-support/contracts';
import { z } from 'zod';

export const createApiKeyBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const createWebhookBodySchema = z.object({
  url: z.string().trim().url(),
  events: z.array(z.enum(WEBHOOK_EVENT_NAMES)).min(1).max(WEBHOOK_EVENT_NAMES.length),
  description: z.string().trim().min(1).max(200).optional(),
});

export const updateWebhookBodySchema = z.object({
  url: z.string().trim().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENT_NAMES)).min(1).max(WEBHOOK_EVENT_NAMES.length).optional(),
  description: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['active', 'paused'] as const).optional(),
});

export const createOAuthApplicationBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  redirectUris: z.array(z.string().trim().url()).min(1).max(10),
  scopes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const oauthAuthorizeQuerySchema = z.object({
  clientId: z.string().min(1).max(200),
  redirectUri: z.string().url(),
  state: z.string().min(1).max(500),
  codeChallenge: z.string().min(16).max(128),
  scope: z.string().max(500).optional(),
  responseType: z.literal('code').optional(),
});

export const approveOAuthBodySchema = z.object({
  clientId: z.string().min(1).max(200),
  redirectUri: z.string().url(),
  state: z.string().min(1).max(500),
  codeChallenge: z.string().min(16).max(128),
  scope: z.string().max(500).optional(),
  approve: z.boolean().optional(),
});

export const exchangeOAuthTokenBodySchema = z.object({
  grantType: z.enum(['authorization_code', 'refresh_token']),
  clientId: z.string().min(1).max(200),
  clientSecret: z.string().min(8).max(8_000),
  code: z.string().min(1).max(4_000).optional(),
  codeVerifier: z.string().min(16).max(128).optional(),
  redirectUri: z.string().url().optional(),
  refreshToken: z.string().min(1).max(4_000).optional(),
});

export const deliveryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
