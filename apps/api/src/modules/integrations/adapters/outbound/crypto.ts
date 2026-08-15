import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { InvalidIntegrationCredentialError } from '../../domain/errors.js';
import type { SecretCipherPort, SecureTokenGeneratorPort, TokenHasherPort, DigestHasherPort } from '../../application/ports.js';

export class AesGcmSecretCipher implements SecretCipherPort {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext: string): { ciphertext: string; nonce: string } {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: encrypted.toString('base64'),
      nonce: `${iv.toString('base64')}.${tag.toString('base64')}`,
    };
  }

  decrypt(ciphertext: string, nonce: string): string {
    const [ivPart, tagPart] = nonce.split('.');
    if (!ivPart || !tagPart) {
      throw new InvalidIntegrationCredentialError('Stored secret is unreadable');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InvalidIntegrationCredentialError('Stored secret is unreadable');
    }
  }
}

export class RandomSecureTokenGenerator implements SecureTokenGeneratorPort {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
}

export class Sha256TokenHasher implements TokenHasherPort, DigestHasherPort {
  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  pkceS256Challenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }
}
