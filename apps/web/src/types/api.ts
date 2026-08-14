export type ApiErrorBody = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiRequestOptions = {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly headers?: HeadersInit;
  readonly signal?: AbortSignal;
};
