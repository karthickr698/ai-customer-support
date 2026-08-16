import type {
  ConversationDto,
  ConversationListResponse,
  IdentifyWidgetSessionRequest,
  MessageAttachmentResponse,
  MessageDto,
  MessageFeedbackResponse,
  MessageListResponse,
  PublicWidgetConfigurationResponse,
  SubmitMessageFeedbackRequest,
  WidgetSessionMeResponse,
  WidgetSessionResponse,
  WidgetStreamEvent,
} from '@ai-customer-support/contracts';
import { isWidgetStreamEvent } from '@ai-customer-support/contracts';
import { isErrorBody, WidgetApiError } from './errors';
import { parseSseChunk } from './parse-sse';

const REQUEST_ID_HEADER = 'x-request-id';

export class WidgetApi {
  constructor(
    private readonly apiBase: string,
    private readonly getToken: () => string | null,
  ) {}

  getConfig(publicKey: string, signal?: AbortSignal): Promise<PublicWidgetConfigurationResponse> {
    return this.request(`/api/widget/${encodeURIComponent(publicKey)}/config`, { signal });
  }

  createSession(
    publicKey: string,
    body: { visitorId?: string; email?: string; name?: string },
    signal?: AbortSignal,
  ): Promise<WidgetSessionResponse> {
    return this.request(`/api/widget/${encodeURIComponent(publicKey)}/sessions`, {
      method: 'POST',
      body,
      signal,
    });
  }

  getSession(signal?: AbortSignal): Promise<WidgetSessionMeResponse> {
    return this.request('/api/widget/sessions/me', { signal });
  }

  identify(body: IdentifyWidgetSessionRequest, signal?: AbortSignal): Promise<WidgetSessionMeResponse> {
    return this.request('/api/widget/sessions/identify', { method: 'POST', body, signal });
  }

  listConversations(signal?: AbortSignal): Promise<ConversationListResponse> {
    return this.request('/api/widget/conversations', {
      query: { page: '1', pageSize: '20' },
      signal,
    });
  }

  startConversation(
    signal?: AbortSignal,
  ): Promise<{ conversation: ConversationDto; message: MessageDto | null }> {
    return this.request('/api/widget/conversations', { method: 'POST', body: {}, signal });
  }

  listMessages(conversationId: string, signal?: AbortSignal): Promise<MessageListResponse> {
    return this.request(`/api/widget/conversations/${conversationId}/messages`, {
      query: { page: '1', pageSize: '100' },
      signal,
    });
  }

  getConversation(conversationId: string, signal?: AbortSignal): Promise<{ conversation: ConversationDto }> {
    return this.request(`/api/widget/conversations/${conversationId}`, { signal });
  }

  openRealtime(conversationId: string): WebSocket {
    const token = this.getToken();
    const url = new URL(this.resolve(`/api/widget/conversations/${conversationId}/realtime`), window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    if (token) {
      url.searchParams.set('session_token', token);
    }

    return new WebSocket(url);
  }

  uploadAttachment(
    conversationId: string,
    file: File,
    signal?: AbortSignal,
  ): Promise<MessageAttachmentResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.request(`/api/widget/conversations/${conversationId}/attachments`, {
      method: 'POST',
      form,
      signal,
    });
  }

  downloadAttachment(conversationId: string, attachmentId: string, signal?: AbortSignal): Promise<Blob> {
    return this.requestBlob(
      `/api/widget/conversations/${conversationId}/attachments/${attachmentId}`,
      signal,
    );
  }

  submitFeedback(
    conversationId: string,
    messageId: string,
    body: SubmitMessageFeedbackRequest,
    signal?: AbortSignal,
  ): Promise<MessageFeedbackResponse> {
    return this.request(
      `/api/widget/conversations/${conversationId}/messages/${messageId}/feedback`,
      { method: 'POST', body, signal },
    );
  }

  async *streamReply(
    conversationId: string,
    body: { body?: string; attachmentIds?: readonly string[] },
    signal?: AbortSignal,
  ): AsyncIterable<WidgetStreamEvent> {
    const response = await fetch(this.resolve(`/api/widget/conversations/${conversationId}/messages/stream`), {
      method: 'POST',
      credentials: 'omit',
      signal,
      headers: {
        ...this.headers(),
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw await this.toError(response);
    }

    if (!response.body) {
      throw new WidgetApiError(response.status, 'STREAM_ERROR', 'Streaming is not available');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;

      for (const frame of parsed.frames) {
        const event = JSON.parse(frame.data) as unknown;
        if (isWidgetStreamEvent(event)) {
          yield event;
        }
      }

      if (done) {
        break;
      }
    }
  }

  private headers(json = true): Record<string, string> {
    const token = this.getToken();
    return {
      Accept: 'application/json',
      [REQUEST_ID_HEADER]: crypto.randomUUID(),
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private resolve(path: string): string {
    if (!this.apiBase) {
      return path;
    }

    return `${this.apiBase}${path}`;
  }

  private async request<T>(
    path: string,
    options: {
      readonly method?: string;
      readonly body?: unknown;
      readonly form?: FormData;
      readonly query?: Record<string, string>;
      readonly signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const url = new URL(this.resolve(path), window.location.origin);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      credentials: 'omit',
      signal: options.signal,
      headers: options.form ? this.headers(false) : this.headers(true),
      body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });

    if (!response.ok) {
      throw await this.toError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async requestBlob(path: string, signal?: AbortSignal): Promise<Blob> {
    const response = await fetch(this.resolve(path), {
      credentials: 'omit',
      signal,
      headers: this.headers(false),
    });

    if (!response.ok) {
      throw await this.toError(response);
    }

    return response.blob();
  }

  private async toError(response: Response): Promise<WidgetApiError> {
    try {
      const body: unknown = await response.json();
      if (isErrorBody(body)) {
        return new WidgetApiError(response.status, body.error.code, body.error.message);
      }
    } catch {
      // Fall through to a generic HTTP error.
    }

    return new WidgetApiError(response.status, 'HTTP_ERROR', response.statusText || 'Request failed');
  }
}
