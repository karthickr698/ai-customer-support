import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { EnforceIpAllowlistUseCase } from '../../../application/use-cases/ip-allowlist-use-cases.js';
import type { ConsumeRequestRateLimitUseCase } from '../../../application/use-cases/rate-limit-use-cases.js';
import type { SecurityPolicyRepository } from '../../../application/ports.js';
import { MAX_URL_LENGTH } from '../../../domain/security-controls.js';
import { InvalidSecurityError, PayloadTooLargeError, UnsupportedMediaTypeError } from '../../../domain/errors.js';
import { isUuid } from '../../../domain/values.js';
import { applySecureHeaders } from './secure-headers.js';

const ORGANIZATION_PATH = /^\/api\/organizations\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;
const SKIP_RATE_LIMIT_PATHS = new Set(['/health', '/ready']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function extractOrganizationIdFromUrl(url: string): string | undefined {
  const path = url.split('?')[0] ?? url;
  const match = ORGANIZATION_PATH.exec(path);
  const id = match?.[1];
  return id && isUuid(id) ? id : undefined;
}

export function registerSecurityHooks(
  app: FastifyInstance,
  input: {
    readonly consumeRateLimit: ConsumeRequestRateLimitUseCase;
    readonly enforceIpAllowlist: EnforceIpAllowlistUseCase;
    readonly policies: SecurityPolicyRepository;
    readonly production: boolean;
    readonly maxRequestBytes: number;
  },
): void {
  app.addHook('onRequest', async (request) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (path.length > MAX_URL_LENGTH || path.includes('\0')) {
      throw new InvalidSecurityError('Request URL is invalid');
    }
    if (SKIP_RATE_LIMIT_PATHS.has(path) || request.method === 'OPTIONS') {
      return;
    }

    const tenantId = extractOrganizationIdFromUrl(path);
    await input.consumeRateLimit.execute({
      ipAddress: request.ip,
      tenantId,
    });

    if (tenantId) {
      const userAgentHeader = request.headers['user-agent'];
      await input.enforceIpAllowlist.execute({
        tenantId,
        ipAddress: request.ip,
        requestId: request.id,
        userAgent: typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
      });
    }

    await enforceJsonPayload(request, tenantId, input.policies, input.maxRequestBytes);
  });

  app.addHook('onSend', async (_request, reply) => {
    applySecureHeaders(reply, input.production);
  });
}

async function enforceJsonPayload(
  request: FastifyRequest,
  tenantId: string | undefined,
  policies: SecurityPolicyRepository,
  globalMaxBytes: number,
): Promise<void> {
  if (!MUTATING_METHODS.has(request.method)) {
    return;
  }
  const contentTypeHeader = request.headers['content-type'];
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
  const normalized = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!normalized || normalized === 'multipart/form-data' || normalized === 'application/octet-stream') {
    return;
  }
  if (request.url.includes('/webhooks/')) {
    return;
  }
  if (normalized !== 'application/json') {
    throw new UnsupportedMediaTypeError();
  }
  const lengthHeader = request.headers['content-length'];
  const length = typeof lengthHeader === 'string' ? Number.parseInt(lengthHeader, 10) : NaN;
  if (!Number.isFinite(length)) {
    return;
  }
  let maxBytes = globalMaxBytes;
  if (tenantId) {
    const policy = await policies.findByTenant(tenantId);
    if (policy) {
      maxBytes = Math.min(policy.maxRequestBytes, globalMaxBytes);
    }
  }
  if (length > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }
}
