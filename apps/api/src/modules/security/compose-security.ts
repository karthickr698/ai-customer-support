import type { EventBus } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerSecurityRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/security-routes.js';
import { registerSecurityHooks } from './adapters/inbound/http/register-security-hooks.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { AesGcmSecretCipher } from './adapters/outbound/crypto/aes-gcm-cipher.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import {
  PostgresSecurityAuditRepository,
  PostgresSecurityIpAllowlistRepository,
  PostgresSecurityPolicyRepository,
  PostgresSecuritySecretRepository,
} from './adapters/outbound/persistence/postgres-security-repositories.js';
import { RedisRateLimiter } from './adapters/outbound/redis/redis-rate-limiter.js';
import { ListSecurityAuditLogsUseCase } from './application/use-cases/audit-use-cases.js';
import { DecryptPayloadUseCase, EncryptPayloadUseCase } from './application/use-cases/encryption-use-cases.js';
import {
  AddSecurityIpAllowlistEntryUseCase,
  EnforceIpAllowlistUseCase,
  ListSecurityIpAllowlistUseCase,
  RemoveSecurityIpAllowlistEntryUseCase,
} from './application/use-cases/ip-allowlist-use-cases.js';
import {
  GetSecurityPolicyUseCase,
  ProvisionSecurityPolicyUseCase,
  UpdateSecurityPolicyUseCase,
} from './application/use-cases/policy-use-cases.js';
import {
  ConsumeRequestRateLimitUseCase,
  GetSecurityRateLimitsUseCase,
} from './application/use-cases/rate-limit-use-cases.js';
import {
  CreateSecuritySecretUseCase,
  GetSecuritySecretUseCase,
  ListSecuritySecretsUseCase,
  RevealSecuritySecretUseCase,
  RevokeSecuritySecretUseCase,
  RotateSecuritySecretUseCase,
} from './application/use-cases/secret-use-cases.js';

export type SecurityModule = {
  register(app: FastifyInstance): Promise<void>;
};

export function composeSecurity(input: {
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly eventBus: EventBus;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly encryptionKey: string;
  readonly encryptionKeyVersion: number;
  readonly production: boolean;
  readonly globalRateLimitPerMinute: number;
  readonly maxRequestBytes: number;
}): SecurityModule {
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const clock = new SystemClock();
  const cipher = new AesGcmSecretCipher(input.encryptionKey, input.encryptionKeyVersion);
  const rateLimiter = new RedisRateLimiter(input.redis);
  const policies = new PostgresSecurityPolicyRepository(input.prisma);
  const allowlist = new PostgresSecurityIpAllowlistRepository(input.prisma);
  const secrets = new PostgresSecuritySecretRepository(input.prisma);
  const audit = new PostgresSecurityAuditRepository(input.prisma);
  const provision = new ProvisionSecurityPolicyUseCase(policies, clock);
  const consumeRateLimit = new ConsumeRequestRateLimitUseCase(
    policies,
    rateLimiter,
    input.globalRateLimitPerMinute,
  );
  const enforceIpAllowlist = new EnforceIpAllowlistUseCase(policies, allowlist, audit, clock);

  input.eventBus.subscribe('OrganizationCreated', async (event) => {
    if (!event.tenantId) {
      return;
    }
    await provision.execute({ tenantId: event.tenantId });
  });

  return {
    async register(app: FastifyInstance): Promise<void> {
      registerSecurityHooks(app, {
        consumeRateLimit,
        enforceIpAllowlist,
        policies,
        production: input.production,
        maxRequestBytes: input.maxRequestBytes,
      });
      await registerSecurityRoutes(
        app,
        {
          getPolicy: new GetSecurityPolicyUseCase(tenantAccess, provision),
          updatePolicy: new UpdateSecurityPolicyUseCase(
            tenantAccess,
            policies,
            audit,
            provision,
            clock,
            input.eventBus,
          ),
          listIpAllowlist: new ListSecurityIpAllowlistUseCase(
            tenantAccess,
            allowlist,
            provision,
          ),
          addIpAllowlist: new AddSecurityIpAllowlistEntryUseCase(
            tenantAccess,
            allowlist,
            audit,
            clock,
            input.eventBus,
          ),
          removeIpAllowlist: new RemoveSecurityIpAllowlistEntryUseCase(
            tenantAccess,
            allowlist,
            audit,
            clock,
            input.eventBus,
          ),
          listSecrets: new ListSecuritySecretsUseCase(tenantAccess, secrets),
          getSecret: new GetSecuritySecretUseCase(tenantAccess, secrets),
          createSecret: new CreateSecuritySecretUseCase(
            tenantAccess,
            secrets,
            cipher,
            audit,
            clock,
            input.eventBus,
          ),
          revealSecret: new RevealSecuritySecretUseCase(tenantAccess, secrets, cipher, audit, clock),
          rotateSecret: new RotateSecuritySecretUseCase(
            tenantAccess,
            secrets,
            cipher,
            audit,
            clock,
            input.eventBus,
          ),
          revokeSecret: new RevokeSecuritySecretUseCase(
            tenantAccess,
            secrets,
            audit,
            clock,
            input.eventBus,
          ),
          encrypt: new EncryptPayloadUseCase(tenantAccess, cipher, audit, clock),
          decrypt: new DecryptPayloadUseCase(tenantAccess, cipher, audit, clock),
          listAuditLogs: new ListSecurityAuditLogsUseCase(tenantAccess, audit),
          getRateLimits: new GetSecurityRateLimitsUseCase(
            tenantAccess,
            rateLimiter,
            provision,
            clock,
            input.globalRateLimitPerMinute,
          ),
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
  };
}
