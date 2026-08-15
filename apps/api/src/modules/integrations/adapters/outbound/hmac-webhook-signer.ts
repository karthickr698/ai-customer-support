import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookSignerPort } from '../../application/ports.js';
import { parseWebhookSignatureHeader } from '../../domain/webhook-signature.js';

export class HmacWebhookSigner implements WebhookSignerPort {
  sign(secret: string, timestampSeconds: number, body: string): string {
    return createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex');
  }

  header(timestampSeconds: number, signature: string): string {
    return `t=${timestampSeconds},v1=${signature}`;
  }

  parseHeader(header: string) {
    return parseWebhookSignatureHeader(header);
  }

  verify(secret: string, timestampSeconds: number, body: string, signature: string): boolean {
    const expected = this.sign(secret, timestampSeconds, body);
    const actual = signature.toLowerCase();
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'));
  }
}
