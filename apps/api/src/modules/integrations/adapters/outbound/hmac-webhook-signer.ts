import { createHmac } from 'node:crypto';
import type { WebhookSignerPort } from '../../application/ports.js';

export class HmacWebhookSigner implements WebhookSignerPort {
  sign(secret: string, timestampSeconds: number, body: string): string {
    return createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex');
  }

  header(timestampSeconds: number, signature: string): string {
    return `t=${timestampSeconds},v1=${signature}`;
  }
}
