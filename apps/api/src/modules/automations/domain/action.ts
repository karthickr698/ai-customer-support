import type { AutomationActionType, AutomationHttpMethod } from '@ai-customer-support/contracts';
import { InvalidAutomationError } from './errors.js';
import { assertSafeAutomationUrl } from './outbound-url.js';
import { jsonObject, normalizeOptionalText, parseHttpMethod } from './values.js';

export type AutomationAction =
  | { readonly type: 'record'; readonly message?: string }
  | {
      readonly type: 'http_request';
      readonly url: string;
      readonly method: AutomationHttpMethod;
      readonly headers: Record<string, string>;
      readonly body: Record<string, unknown>;
      readonly timeoutMs: number;
    }
  | { readonly type: 'emit_event'; readonly data: Record<string, unknown> };

export function parseAction(
  type: AutomationActionType,
  config: unknown,
  options?: { readonly allowLocalHttp?: boolean },
): AutomationAction {
  const record = jsonObject(config, 'Action');
  if (type === 'record') {
    return {
      type: 'record',
      message: normalizeOptionalText(
        typeof record.message === 'string' ? record.message : undefined,
        'Action message',
        500,
      ),
    };
  }
  if (type === 'emit_event') {
    return { type: 'emit_event', data: jsonObject(record.data, 'Action data') };
  }
  const urlRaw = typeof record.url === 'string' ? record.url : '';
  const timeoutMs = typeof record.timeoutMs === 'number' ? record.timeoutMs : 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw new InvalidAutomationError('HTTP timeoutMs must be an integer between 1000 and 30000');
  }
  return {
    type: 'http_request',
    url: assertSafeAutomationUrl(urlRaw, 'Action URL', { allowLocalHttp: options?.allowLocalHttp }),
    method: parseHttpMethod(typeof record.method === 'string' ? record.method : undefined),
    headers: parseHeaders(record.headers),
    body: jsonObject(record.body, 'Action body'),
    timeoutMs,
  };
}

export function actionToConfig(action: AutomationAction): Record<string, unknown> {
  if (action.type === 'record') {
    return action.message ? { message: action.message } : {};
  }
  if (action.type === 'emit_event') {
    return { data: action.data };
  }
  return {
    url: action.url,
    method: action.method,
    headers: action.headers,
    body: action.body,
    timeoutMs: action.timeoutMs,
  };
}

function parseHeaders(raw: unknown): Record<string, string> {
  if (raw === undefined || raw === null) {
    return {};
  }
  const record = jsonObject(raw, 'Action headers');
  const headers: Record<string, string> = {};
  const entries = Object.entries(record);
  if (entries.length > 20) {
    throw new InvalidAutomationError('Action headers may have at most 20 entries');
  }
  for (const [key, value] of entries) {
    const name = key.trim().toLowerCase();
    if (!name || name.length > 64) {
      throw new InvalidAutomationError('Action header names are invalid');
    }
    if (name === 'authorization' || name === 'cookie' || name.startsWith('x-api-key')) {
      throw new InvalidAutomationError('Secret headers are not allowed on automation HTTP actions');
    }
    if (typeof value !== 'string' || value.length > 500) {
      throw new InvalidAutomationError('Action header values must be strings of at most 500 characters');
    }
    headers[name] = value;
  }
  return headers;
}
