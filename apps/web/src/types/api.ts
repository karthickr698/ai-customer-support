export type ApiErrorBody = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryParamValue = string | number | boolean | undefined | null;

export type ApiRequestOptions = {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly headers?: HeadersInit;
  readonly signal?: AbortSignal;
  readonly params?: Record<string, QueryParamValue>;
  readonly timeoutMs?: number;
};

export type PaginatedResponse<T> = {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

export type LivenessStatus = {
  readonly status: 'ok';
};

export type ReadinessStatus = {
  readonly status: 'ok' | 'unavailable';
  readonly checks: {
    readonly database: 'up' | 'down';
    readonly redis: 'up' | 'down';
  };
};
