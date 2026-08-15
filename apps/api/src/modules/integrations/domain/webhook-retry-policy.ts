export const WEBHOOK_MAX_ATTEMPTS = 5;
export const WEBHOOK_RETRY_BACKOFF_SECONDS = [60, 300, 1_800, 7_200, 28_800] as const;
export const WEBHOOK_DISPATCH_INTERVAL_MS = 5_000;
export const WEBHOOK_DISPATCH_BATCH_SIZE = 50;
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;
export const WEBHOOK_RESPONSE_PREVIEW_LENGTH = 500;
export const WEBHOOK_ERROR_MESSAGE_LENGTH = 500;

export function webhookRetryDelaySeconds(attemptCount: number): number {
  const index = Math.min(Math.max(attemptCount, 1), WEBHOOK_RETRY_BACKOFF_SECONDS.length) - 1;
  return WEBHOOK_RETRY_BACKOFF_SECONDS[index] ?? WEBHOOK_RETRY_BACKOFF_SECONDS[0];
}

export function webhookHasRetriesRemaining(attemptCount: number): boolean {
  return attemptCount < WEBHOOK_MAX_ATTEMPTS;
}
