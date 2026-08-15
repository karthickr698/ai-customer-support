import type { WebhookDispatcherPort, WebhookDispatchRequest, WebhookDispatchResult } from '../../application/ports.js';

export class FetchWebhookDispatcher implements WebhookDispatcherPort {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async dispatch(request: WebhookDispatchRequest): Promise<WebhookDispatchResult> {
    const response = await this.fetchImpl(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(request.timeoutMs),
    });
    return { status: response.status };
  }
}
