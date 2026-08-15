import type { WebhookDispatcherPort, WebhookDispatchRequest, WebhookDispatchResult } from '../../application/ports.js';
import { WEBHOOK_RESPONSE_PREVIEW_LENGTH } from '../../domain/webhook-retry-policy.js';

export class FetchWebhookDispatcher implements WebhookDispatcherPort {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async dispatch(request: WebhookDispatchRequest): Promise<WebhookDispatchResult> {
    const started = Date.now();
    const response = await this.fetchImpl(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(request.timeoutMs),
    });
    const durationMs = Date.now() - started;
    const text = await response.text().catch(() => '');
    return {
      status: response.status,
      durationMs,
      bodyPreview: text.slice(0, WEBHOOK_RESPONSE_PREVIEW_LENGTH) || undefined,
    };
  }
}
