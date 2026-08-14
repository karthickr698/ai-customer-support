import { createHash, randomBytes } from 'node:crypto';
import type { ClockPort } from '../../../application/ports/clock-port.js';
import type { SecureTokenGeneratorPort } from '../../../application/ports/secure-token-generator-port.js';
import type { TokenHasherPort } from '../../../application/ports/token-hasher-port.js';

export class RandomSecureTokenGenerator implements SecureTokenGeneratorPort {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
}

export class Sha256TokenHasher implements TokenHasherPort {
  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
