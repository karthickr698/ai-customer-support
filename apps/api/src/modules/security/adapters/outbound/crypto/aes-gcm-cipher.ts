import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createEncryptionEnvelope, type EncryptionEnvelope } from '../../../domain/encryption-envelope.js';
import { UnreadableSecuritySecretError } from '../../../domain/errors.js';
import type { SecretCipherPort } from '../../../application/ports.js';

export class AesGcmSecretCipher implements SecretCipherPort {
  private readonly key: Buffer;

  constructor(
    secret: string,
    readonly keyVersion: number,
  ) {
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(plaintext: string): EncryptionEnvelope {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return createEncryptionEnvelope({
      ciphertext: encrypted.toString('base64'),
      nonce: `${iv.toString('base64')}.${tag.toString('base64')}`,
      keyVersion: this.keyVersion,
    });
  }

  decrypt(envelope: EncryptionEnvelope): string {
    const [ivPart, tagPart] = envelope.nonce.split('.');
    if (!ivPart || !tagPart) {
      throw new UnreadableSecuritySecretError();
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivPart, 'base64'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new UnreadableSecuritySecretError();
    }
  }
}
