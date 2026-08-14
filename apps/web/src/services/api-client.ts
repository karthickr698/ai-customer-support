import axios, { isAxiosError, isCancel } from 'axios';
import type { ApiRequestOptions } from '@/types/api';
import { env } from '@/utils/env';
import { ApiError, isApiErrorBody } from './api-error';

const REQUEST_ID_HEADER = 'x-request-id';

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

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
      message: 'Unable to reach the API',
      status: 0,
      code: 'NETWORK_ERROR',
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
      signal: options.signal,
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
