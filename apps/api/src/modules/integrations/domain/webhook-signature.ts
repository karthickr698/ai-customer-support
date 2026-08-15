import { WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } from './webhook-retry-policy.js';

export type ParsedWebhookSignatureHeader = {
  readonly timestampSeconds: number;
  readonly signatures: readonly string[];
};

export function parseWebhookSignatureHeader(header: string): ParsedWebhookSignatureHeader | undefined {
  const parts = header
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  let timestampSeconds: number | undefined;
  const signatures: string[] = [];
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (key === 't') {
      const timestamp = Number(value);
      if (!Number.isInteger(timestamp) || timestamp <= 0) {
        return undefined;
      }
      timestampSeconds = timestamp;
    }
    if (key === 'v1' && /^[a-f0-9]{64}$/i.test(value)) {
      signatures.push(value.toLowerCase());
    }
  }
  if (!timestampSeconds || signatures.length === 0) {
    return undefined;
  }
  return { timestampSeconds, signatures };
}

export function isWebhookTimestampFresh(
  timestampSeconds: number,
  now: Date,
  toleranceSeconds = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  return Math.abs(nowSeconds - timestampSeconds) <= toleranceSeconds;
}

export function webhookSignedPayload(timestampSeconds: number, body: string): string {
  return `${timestampSeconds}.${body}`;
}
