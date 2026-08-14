import type { AppConfig } from '@ai-customer-support/config';
import type { EventBus, Logger } from '@ai-customer-support/shared';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { QueuePort } from '../shared/application/ports/queue-port.js';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly prisma: PrismaClient;
  readonly redis: Redis;
  readonly eventBus: EventBus;
  readonly queue: QueuePort;
}
