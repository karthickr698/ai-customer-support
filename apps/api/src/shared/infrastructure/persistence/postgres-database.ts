import type { PrismaClient } from '@prisma/client';
import type { DatabasePort } from '../../application/ports/database-port.js';

export class PostgresDatabase implements DatabasePort {
  constructor(private readonly client: PrismaClient) {}

  async connect(): Promise<void> {
    await this.client.$connect();
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }

  async isReady(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Prisma client for outbound repository adapters constructed in the composition root.
   * Domain and use cases must not import this.
   */
  forRepositoryAdapter(): PrismaClient {
    return this.client;
  }
}
