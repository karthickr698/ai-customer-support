import { AssignmentPolicy } from '../../../domain/assignment-policy.js';
import type { AssignmentCursorPort } from '../../../application/ports/assignment-cursor-port.js';
import type { Redis } from 'ioredis';

export class RedisAssignmentCursorAdapter implements AssignmentCursorPort {
  constructor(private readonly redis: Redis) {}

  async takeNext(tenantId: string, candidateIds: readonly string[]): Promise<string | undefined> {
    const key = `assignment:cursor:${tenantId}`;
    const last = (await this.redis.get(key)) ?? undefined;
    const next = AssignmentPolicy.pickRoundRobin(candidateIds, last);
    if (next) {
      await this.redis.set(key, next);
    }

    return next;
  }
}
