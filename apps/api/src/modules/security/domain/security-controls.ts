export const DEFAULT_SESSION_IDLE_TIMEOUT_SECONDS = 28_800;
export const MIN_SESSION_IDLE_TIMEOUT_SECONDS = 300;
export const MAX_SESSION_IDLE_TIMEOUT_SECONDS = 86_400;

export const DEFAULT_MAX_REQUEST_BYTES = 1_048_576;
export const MIN_MAX_REQUEST_BYTES = 1_024;
export const MAX_REQUEST_BYTES = 10 * 1_024 * 1_024;

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
export const MIN_RATE_LIMIT_PER_MINUTE = 10;
export const MAX_RATE_LIMIT_PER_MINUTE = 10_000;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

export const DEFAULT_AUDIT_RETENTION_DAYS = 365;
export const MIN_AUDIT_RETENTION_DAYS = 7;
export const MAX_AUDIT_RETENTION_DAYS = 2_555;

export const MAX_IP_ALLOWLIST_ENTRIES = 50;
export const MAX_SECRETS_PER_TENANT = 50;
export const MAX_SECRET_PLAINTEXT_BYTES = 16_384;
export const MAX_ENCRYPT_PLAINTEXT_BYTES = 16_384;
export const MAX_URL_LENGTH = 2_048;

export const ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;

export const SENSITIVE_METADATA_KEYS = [
  'plaintext',
  'password',
  'secret',
  'token',
  'authorization',
  'apiKey',
  'api_key',
  'ciphertext',
  'nonce',
] as const;
