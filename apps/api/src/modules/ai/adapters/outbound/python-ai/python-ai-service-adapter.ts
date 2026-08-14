import { isAIServiceHealthResponse } from '@ai-customer-support/contracts';
import type { Logger } from '@ai-customer-support/shared';
import type { AIServicePort } from '../../../application/ports/ai-service-port.js';

const HEALTH_TIMEOUT_MS = 3_000;

export class PythonAIServiceAdapter implements AIServicePort {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async isReady(): Promise<boolean> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });

      if (!response.ok) {
        return false;
      }

      const body: unknown = await response.json();
      return isAIServiceHealthResponse(body);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Python AI health check failed';
      this.logger.warn('Python AI service is not reachable', { message });
      return false;
    }
  }
}
