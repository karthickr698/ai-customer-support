import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { AIServicePort } from '../ai/application/ports/ai-service-port.js';
import type { IdentityUserQuery } from '../identity/application/identity-user-query.js';
import type { OrganizationAdminQuery } from '../organizations/application/organization-admin-query.js';
import type { DatabasePort } from '../../shared/application/ports/database-port.js';
import type { RedisPort } from '../../shared/application/ports/redis-port.js';
import {
  registerPlatformRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/platform-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { InfrastructurePlatformHealthProbe } from './adapters/outbound/health/infrastructure-platform-health-probe.js';
import { IdentityUserDirectoryAdapter } from './adapters/outbound/identity/identity-user-directory-adapter.js';
import { OrganizationsTenantDirectoryAdapter } from './adapters/outbound/organizations/organizations-tenant-directory-adapter.js';
import {
  PostgresFeatureFlagOverrideRepository,
  PostgresFeatureFlagRepository,
  PostgresOperationalAuditRepository,
  PostgresPlatformOperatorRepository,
} from './adapters/outbound/persistence/postgres-platform-repositories.js';
import { ListOperationalAuditLogsUseCase } from './application/use-cases/audit-use-cases.js';
import {
  CreateFeatureFlagUseCase,
  DeleteFeatureFlagUseCase,
  EvaluateFeatureFlagUseCase,
  GetFeatureFlagUseCase,
  ListFeatureFlagsUseCase,
  RemoveFeatureFlagOverrideUseCase,
  SeedFeatureFlagsUseCase,
  SetFeatureFlagOverrideUseCase,
  UpdateFeatureFlagUseCase,
} from './application/use-cases/feature-flag-use-cases.js';
import { GetPlatformHealthUseCase } from './application/use-cases/health-use-case.js';
import {
  BootstrapPlatformOwnerUseCase,
  ChangePlatformOperatorRoleUseCase,
  GetCurrentPlatformOperatorUseCase,
  GrantPlatformOperatorUseCase,
  ListPlatformOperatorsUseCase,
  LoadPlatformActorService,
  RevokePlatformOperatorUseCase,
} from './application/use-cases/operator-use-cases.js';
import {
  ActivatePlatformTenantUseCase,
  GetPlatformTenantUseCase,
  ListPlatformTenantsUseCase,
  SuspendPlatformTenantUseCase,
} from './application/use-cases/tenant-use-cases.js';

export type PlatformModule = {
  register(app: FastifyInstance): Promise<void>;
  start(): Promise<void>;
  readonly actors: LoadPlatformActorService;
};

export function composePlatform(input: {
  readonly prisma: PrismaClient;
  readonly database: DatabasePort;
  readonly redis: RedisPort;
  readonly aiService: AIServicePort;
  readonly eventBus: EventBus;
  readonly logger: Logger;
  readonly authenticate: AuthenticatePreHandler;
  readonly userQuery: IdentityUserQuery;
  readonly organizationAdmin: OrganizationAdminQuery;
  readonly bootstrapEmail?: string;
}): PlatformModule {
  const clock = new SystemClock();
  const users = new IdentityUserDirectoryAdapter(input.userQuery);
  const tenants = new OrganizationsTenantDirectoryAdapter(input.organizationAdmin);
  const operators = new PostgresPlatformOperatorRepository(input.prisma);
  const flags = new PostgresFeatureFlagRepository(input.prisma);
  const overrides = new PostgresFeatureFlagOverrideRepository(input.prisma);
  const audit = new PostgresOperationalAuditRepository(input.prisma);
  const actors = new LoadPlatformActorService(operators);
  const healthProbe = new InfrastructurePlatformHealthProbe(input.database, input.redis, input.aiService);
  const seedFlags = new SeedFeatureFlagsUseCase(flags, clock);
  const bootstrap = new BootstrapPlatformOwnerUseCase(
    operators,
    users,
    audit,
    clock,
    input.eventBus,
    input.bootstrapEmail,
  );

  return {
    actors,
    async register(app: FastifyInstance): Promise<void> {
      await registerPlatformRoutes(
        app,
        {
          getMe: new GetCurrentPlatformOperatorUseCase(operators, users),
          bootstrap,
          listOperators: new ListPlatformOperatorsUseCase(actors, operators, users),
          grantOperator: new GrantPlatformOperatorUseCase(
            actors,
            operators,
            users,
            audit,
            clock,
            input.eventBus,
          ),
          changeOperatorRole: new ChangePlatformOperatorRoleUseCase(
            actors,
            operators,
            users,
            audit,
            clock,
            input.eventBus,
          ),
          revokeOperator: new RevokePlatformOperatorUseCase(
            actors,
            operators,
            users,
            audit,
            clock,
            input.eventBus,
          ),
          listTenants: new ListPlatformTenantsUseCase(actors, tenants),
          getTenant: new GetPlatformTenantUseCase(actors, tenants),
          suspendTenant: new SuspendPlatformTenantUseCase(
            actors,
            tenants,
            audit,
            clock,
            input.eventBus,
          ),
          activateTenant: new ActivatePlatformTenantUseCase(
            actors,
            tenants,
            audit,
            clock,
            input.eventBus,
          ),
          listFlags: new ListFeatureFlagsUseCase(actors, flags, overrides),
          getFlag: new GetFeatureFlagUseCase(actors, flags, overrides),
          createFlag: new CreateFeatureFlagUseCase(actors, flags, audit, clock, input.eventBus),
          updateFlag: new UpdateFeatureFlagUseCase(
            actors,
            flags,
            overrides,
            audit,
            clock,
            input.eventBus,
          ),
          deleteFlag: new DeleteFeatureFlagUseCase(
            actors,
            flags,
            overrides,
            audit,
            clock,
            input.eventBus,
          ),
          setFlagOverride: new SetFeatureFlagOverrideUseCase(
            actors,
            flags,
            overrides,
            tenants,
            audit,
            clock,
            input.eventBus,
          ),
          removeFlagOverride: new RemoveFeatureFlagOverrideUseCase(
            actors,
            flags,
            overrides,
            audit,
            clock,
            input.eventBus,
          ),
          evaluateFlag: new EvaluateFeatureFlagUseCase(actors, flags, overrides),
          getHealth: new GetPlatformHealthUseCase(actors, healthProbe, clock),
          listAuditLogs: new ListOperationalAuditLogsUseCase(actors, audit),
        },
        input.authenticate,
        actors,
      );
    },
    async start(): Promise<void> {
      await seedFlags.execute();
      try {
        await bootstrap.execute({});
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Platform bootstrap skipped';
        input.logger.info('Platform bootstrap did not grant an owner', { message });
      }
    },
  };
}
