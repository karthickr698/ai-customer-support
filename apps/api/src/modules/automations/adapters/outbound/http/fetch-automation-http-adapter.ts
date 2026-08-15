import { AutomationActionFailedError } from '../../../domain/errors.js';
import type { AutomationHttpPort, AutomationHttpRequest, AutomationHttpResult } from '../../../application/ports.js';

export class FetchAutomationHttpAdapter implements AutomationHttpPort {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async request(input: AutomationHttpRequest): Promise<AutomationHttpResult> {
    try {
      const response = await this.fetchImpl(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.method === 'GET' ? undefined : JSON.stringify(input.body ?? {}),
        signal: AbortSignal.timeout(input.timeoutMs),
      });
      return { status: response.status, data: await readJsonObject(response) };
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new AutomationActionFailedError('HTTP action timed out');
      }
      const message = error instanceof Error ? error.message : 'HTTP action failed';
      throw new AutomationActionFailedError(message);
    }
  }
}

async function readJsonObject(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return {};
  }
}
