import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { IdentityUserQuery } from '../identity/application/identity-user-query.js';
import type { OrganizationMemberQuery } from '../organizations/application/organization-member-query.js';
import type { ResolveTenantAccessUseCase } from '../organizations/application/use-cases/resolve-tenant-access-use-case.js';
import {
  registerAgentPresenceRoutes,
  type AuthenticatePreHandler,
} from './adapters/inbound/http/agent-presence-routes.js';
import { SystemClock } from './adapters/outbound/clock/system-clock.js';
import { OrganizationsMemberDirectoryAdapter } from './adapters/outbound/organizations/organizations-member-directory-adapter.js';
import { OrganizationsTenantAccessAdapter } from './adapters/outbound/organizations/organizations-tenant-access-adapter.js';
import { RedisAgentPresenceStore } from './adapters/outbound/redis/redis-agent-presence-store.js';
import { AgentPresenceQuery } from './application/agent-presence-query.js';
import {
  ListAgentPresenceUseCase,
  SetOwnAgentPresenceUseCase,
} from './application/use-cases/list-and-set-agent-presence-use-cases.js';
import {
  ConnectAgentPresenceUseCase,
  DisconnectAgentPresenceUseCase,
  HeartbeatAgentPresenceUseCase,
  SetAgentPresenceStatusUseCase,
} from './application/use-cases/mutate-agent-presence-use-cases.js';
import { SweepStaleAgentPresenceUseCase } from './application/use-cases/sweep-stale-agent-presence-use-case.js';
import { PRESENCE_HEARTBEAT_INTERVAL_MS } from './domain/presence-constants.js';

export type AgentsModule = {
  readonly presenceQuery: AgentPresenceQuery;
  readonly listPresence: ListAgentPresenceUseCase;
  readonly connectPresence: ConnectAgentPresenceUseCase;
  readonly disconnectPresence: DisconnectAgentPresenceUseCase;
  readonly heartbeatPresence: HeartbeatAgentPresenceUseCase;
  readonly setPresence: SetAgentPresenceStatusUseCase;
  register(app: FastifyInstance): Promise<void>;
  start(): void;
  stop(): void;
};

export function composeAgents(input: {
  readonly redis: Redis;
  readonly eventBus: EventBus;
  readonly logger: Logger;
  readonly authenticate: AuthenticatePreHandler;
  readonly resolveTenantAccess: ResolveTenantAccessUseCase;
  readonly memberQuery: OrganizationMemberQuery;
  readonly userDirectory: IdentityUserQuery;
}): AgentsModule {
  const store = new RedisAgentPresenceStore(input.redis);
  const clock = new SystemClock();
  const tenantAccess = new OrganizationsTenantAccessAdapter(input.resolveTenantAccess);
  const members = new OrganizationsMemberDirectoryAdapter(input.memberQuery);
  const setStatus = new SetAgentPresenceStatusUseCase(store, clock, input.eventBus);
  const heartbeat = new HeartbeatAgentPresenceUseCase(store, clock, input.eventBus);
  const connectPresence = new ConnectAgentPresenceUseCase(store, clock, input.eventBus);
  const disconnectPresence = new DisconnectAgentPresenceUseCase(store, clock);
  const listPresence = new ListAgentPresenceUseCase(
    tenantAccess,
    members,
    store,
    input.userDirectory,
    clock,
  );
  const setOwnPresence = new SetOwnAgentPresenceUseCase(
    tenantAccess,
    members,
    input.userDirectory,
    setStatus,
  );
  const sweep = new SweepStaleAgentPresenceUseCase(store, clock, input.eventBus);
  const presenceQuery = new AgentPresenceQuery(store);
  let timer: NodeJS.Timeout | undefined;

  return {
    presenceQuery,
    listPresence,
    connectPresence,
    disconnectPresence,
    heartbeatPresence: heartbeat,
    setPresence: setStatus,
    async register(app: FastifyInstance): Promise<void> {
      await registerAgentPresenceRoutes(
        app,
        {
          listPresence,
          setOwnPresence,
          heartbeat,
        },
        input.authenticate,
        input.resolveTenantAccess,
      );
    },
    start(): void {
      timer = setInterval(() => {
        void sweep.execute().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Presence sweep failed';
          input.logger.warn('Presence sweep failed', { message });
        });
      }, PRESENCE_HEARTBEAT_INTERVAL_MS);
      timer.unref();
    },
    stop(): void {
      if (timer) {
        clearInterval(timer);
      }
    },
  };
}
