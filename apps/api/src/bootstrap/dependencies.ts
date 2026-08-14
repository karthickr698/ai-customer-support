import type { AppConfig } from '@ai-customer-support/config';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { AIServicePort } from '../modules/ai/application/ports/ai-service-port.js';
import type { IdentityHttpRegistrar } from '../modules/identity/compose-identity.js';
import type { OrganizationsHttpRegistrar } from '../modules/organizations/compose-organizations.js';
import type { DatabasePort } from '../shared/application/ports/database-port.js';
import type { QueuePort } from '../shared/application/ports/queue-port.js';
import type { RedisPort } from '../shared/application/ports/redis-port.js';
import type { InfrastructureHealthChecker } from '../shared/infrastructure/health/infrastructure-health-checker.js';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly database: DatabasePort;
  readonly redis: RedisPort;
  readonly eventBus: EventBus;
  readonly queue: QueuePort;
  readonly aiService: AIServicePort;
  readonly healthChecker: InfrastructureHealthChecker;
  readonly identity?: IdentityHttpRegistrar;
  readonly organizations?: OrganizationsHttpRegistrar;
}
