import {
  INTEGRATION_CREDENTIAL_KINDS,
  OAUTH_CONNECTOR_PROVIDERS,
  TOOL_NAMES,
} from '@ai-customer-support/contracts';
import { z } from 'zod';

export const executeToolCallBodySchema = z.object({
  name: z.enum(TOOL_NAMES),
  arguments: z.record(z.string(), z.unknown()),
  conversationId: z.string().uuid().optional(),
  actorType: z.enum(['user', 'ai']).optional(),
});

export const upsertCredentialBodySchema = z.object({
  toolName: z.enum(TOOL_NAMES),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(INTEGRATION_CREDENTIAL_KINDS),
  secret: z.string().min(8).max(8_000),
  baseUrl: z.string().trim().url(),
  headerName: z.string().trim().min(1).max(80).optional(),
  provider: z.string().trim().min(1).max(40).optional(),
});

export const upsertOAuthConnectorBodySchema = z.object({
  provider: z.enum(OAUTH_CONNECTOR_PROVIDERS),
  name: z.string().trim().min(1).max(120),
  clientId: z.string().trim().min(1).max(200),
  clientSecret: z.string().min(8).max(8_000),
  authorizationUrl: z.string().trim().url(),
  tokenUrl: z.string().trim().url(),
  scopes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
});

export const completeOAuthBodySchema = z.object({
  code: z.string().min(1).max(4_000),
  state: z.string().min(1).max(500),
});

export const proposeToolCallsBodySchema = z.object({
  conversationId: z.string().min(1).max(80),
  visitorMessage: z.string().trim().min(1).max(10_000),
  history: z
    .array(
      z.object({
        role: z.string().min(1).max(40),
        content: z.string().min(1).max(10_000),
      }),
    )
    .max(50)
    .optional(),
  allowedTools: z.array(z.enum(TOOL_NAMES)).max(TOOL_NAMES.length).optional(),
});

export const applyToolResultsBodySchema = z.object({
  conversationId: z.string().min(1).max(80),
  visitorMessage: z.string().trim().min(1).max(10_000),
  history: z
    .array(
      z.object({
        role: z.string().min(1).max(40),
        content: z.string().min(1).max(10_000),
      }),
    )
    .max(50)
    .optional(),
  results: z
    .array(
      z.object({
        name: z.enum(TOOL_NAMES),
        ok: z.boolean(),
        data: z.record(z.string(), z.unknown()).nullable(),
        errorCode: z.string().nullable(),
        errorMessage: z.string().nullable(),
      }),
    )
    .min(1)
    .max(10),
});

export const invocationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
