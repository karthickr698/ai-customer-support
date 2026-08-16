import { assertSafeHttpsUrl } from '../../domain/outbound-url.js';
import type {
  ConnectorHealthProbePort,
  ConnectorHealthProbeRequest,
  ConnectorHealthProbeResult,
} from '../../application/ports.js';

const DEFAULT_TIMEOUT_MS = 8_000;

export class FetchConnectorHealthProbe implements ConnectorHealthProbePort {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async probe(request: ConnectorHealthProbeRequest): Promise<ConnectorHealthProbeResult> {
    const url = assertSafeHttpsUrl(request.url, 'Health check URL');
    const started = Date.now();
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        headers: request.headers,
        signal: AbortSignal.timeout(request.timeoutMs || DEFAULT_TIMEOUT_MS),
      });
      const latencyMs = Date.now() - started;
      if (response.ok || response.status === 404) {
        return {
          ok: true,
          status: response.status,
          latencyMs,
          message:
            response.status === 404
              ? 'The host responded. The base URL has no document at this path, which is normal for many APIs.'
              : `Connector responded with HTTP ${response.status}.`,
        };
      }
      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          status: response.status,
          latencyMs,
          message: 'The connector rejected the stored credential.',
        };
      }
      return {
        ok: false,
        status: response.status,
        latencyMs,
        message: `Connector returned HTTP ${response.status}.`,
      };
    } catch (error: unknown) {
      const latencyMs = Date.now() - started;
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        return {
          ok: false,
          status: null,
          latencyMs,
          message: 'The health check timed out.',
        };
      }
      return {
        ok: false,
        status: null,
        latencyMs,
        message: 'The connector could not be reached.',
      };
    }
  }
}
