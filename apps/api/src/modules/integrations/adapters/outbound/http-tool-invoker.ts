import { ToolExecutionError, ToolTimeoutError } from '../../domain/errors.js';
import type {
  HttpToolInvokeRequest,
  HttpToolInvokeResult,
  HttpToolInvokerPort,
} from '../../application/ports.js';

export class FetchHttpToolInvoker implements HttpToolInvokerPort {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async invoke(request: HttpToolInvokeRequest): Promise<HttpToolInvokeResult> {
    let lastError: unknown;
    const attempts = Math.max(1, request.maxAttempts);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
          signal: AbortSignal.timeout(request.timeoutMs),
        });

        const data = await readJsonObject(response);
        if (response.ok || !shouldRetryStatus(response.status) || attempt === attempts) {
          return { status: response.status, data, attemptCount: attempt };
        }
        lastError = new ToolExecutionError(`Connector returned HTTP ${response.status}`);
      } catch (error: unknown) {
        lastError = error;
        if (!isRetryableNetworkError(error) || attempt === attempts) {
          if (isTimeout(error)) {
            throw new ToolTimeoutError();
          }
          throw error instanceof ToolExecutionError || error instanceof ToolTimeoutError
            ? error
            : new ToolExecutionError();
        }
      }

      if (request.backoffMs > 0) {
        await sleep(request.backoffMs * attempt);
      }
    }

    if (isTimeout(lastError)) {
      throw new ToolTimeoutError();
    }
    throw lastError instanceof Error ? new ToolExecutionError(lastError.message) : new ToolExecutionError();
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

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

function isRetryableNetworkError(error: unknown): boolean {
  return isTimeout(error) || (error instanceof TypeError && error.message.includes('fetch'));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
