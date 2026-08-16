import axios, { isAxiosError, isCancel } from 'axios';
import { useSessionStore } from '@/stores/session-store';
import type { ApiRequestOptions, QueryParamValue } from '@/types/api';
import { env } from '@/utils/env';
import { ApiError, isApiErrorBody } from './api-error';

const REQUEST_ID_HEADER = 'x-request-id';
const TENANT_HEADER = 'x-tenant-id';

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const requestId =
    typeof config.headers.get === 'function'
      ? config.headers.get(REQUEST_ID_HEADER)
      : config.headers[REQUEST_ID_HEADER];

  if (!requestId) {
    config.headers.set(REQUEST_ID_HEADER, crypto.randomUUID());
  }

  const { accessToken, tenantId } = useSessionStore.getState();

  if (accessToken && !config.headers.get('Authorization')) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (tenantId && !config.headers.get(TENANT_HEADER)) {
    config.headers.set(TENANT_HEADER, tenantId);
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      return Promise.reject(error);
    }

    const requestUrl = error.config.url ?? '';
    if (shouldSkipRefresh(requestUrl) || retriedRequests.has(error.config)) {
      if (!isAuthAnonymousEndpoint(requestUrl)) {
        useSessionStore.getState().clearSession();
      }
      return Promise.reject(error);
    }

    retriedRequests.add(error.config);

    try {
      await refreshAccessSession();
      return http.request(error.config);
    } catch {
      useSessionStore.getState().clearSession();
      return Promise.reject(error);
    }
  },
);

const retriedRequests = new WeakSet<object>();
let refreshInFlight: Promise<void> | undefined;

function shouldSkipRefresh(url: string): boolean {
  return [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/google/start',
    '/api/auth/google/complete',
    '/api/auth/password/forgot',
    '/api/auth/password/reset',
    '/api/auth/email/verify',
    '/api/auth/email/resend',
  ].some((path) => url.includes(path));
}

function isAuthAnonymousEndpoint(url: string): boolean {
  return url.includes('/api/auth/');
}

async function refreshAccessSession(): Promise<void> {
  refreshInFlight ??= http
    .post('/api/auth/refresh')
    .then(() => undefined)
    .finally(() => {
      refreshInFlight = undefined;
    });

  await refreshInFlight;
}

function resolveUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function compactParams(params: Record<string, QueryParamValue> | undefined): Record<string, string> | undefined {
  if (!params) {
    return undefined;
  }

  const next: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    next[key] = String(value);
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function requestIdFromHeaders(headers: unknown, fallback: string): string {
  if (!headers || typeof headers !== 'object') {
    return fallback;
  }

  if ('get' in headers && typeof headers.get === 'function') {
    const value: unknown = headers.get(REQUEST_ID_HEADER);
    return typeof value === 'string' && value !== '' ? value : fallback;
  }

  const record = headers as Record<string, unknown>;
  const value = record[REQUEST_ID_HEADER];
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function toApiError(error: unknown, fallbackRequestId: string): ApiError {
  if (!isAxiosError(error)) {
    return new ApiError({
      message: 'Unable to reach the API',
      status: 0,
      code: 'NETWORK_ERROR',
      requestId: fallbackRequestId,
    });
  }

  const requestId = requestIdFromHeaders(error.config?.headers, fallbackRequestId);
  const response = error.response;

  if (!response) {
    return new ApiError({
      message: error.code === 'ECONNABORTED' ? 'The request timed out' : 'Unable to reach the API',
      status: 0,
      code: error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR',
      requestId,
    });
  }

  if (isApiErrorBody(response.data)) {
    return new ApiError({
      message: response.data.error.message,
      status: response.status,
      code: response.data.error.code,
      requestId: requestIdFromHeaders(response.headers, requestId),
    });
  }

  return new ApiError({
    message: response.statusText || 'Request failed',
    status: response.status,
    code: 'HTTP_ERROR',
    requestId: requestIdFromHeaders(response.headers, requestId),
  });
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const requestId = crypto.randomUUID();

  try {
    const response = await http.request<T>({
      url: resolveUrl(path),
      method: options.method ?? 'GET',
      data: options.body,
      params: compactParams(options.params),
      signal: options.signal,
      timeout: options.timeoutMs,
      validateStatus: options.validateStatus,
      headers: {
        ...headerRecord(options.headers),
        [REQUEST_ID_HEADER]: requestId,
        Accept: 'application/json',
      },
    });

    return response.data;
  } catch (error: unknown) {
    if (isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) {
      throw error;
    }

    throw toApiError(error, requestId);
  }
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
