import { InvalidSecurityEnvelopeError } from './errors.js';
import { ENCRYPTION_ALGORITHM } from './security-controls.js';
import { parseEncryptionAlgorithm, requireBoundedInt } from './values.js';

export type EncryptionEnvelope = {
  readonly algorithm: typeof ENCRYPTION_ALGORITHM;
  readonly keyVersion: number;
  readonly ciphertext: string;
  readonly nonce: string;
};

export function createEncryptionEnvelope(input: {
  readonly ciphertext: string;
  readonly nonce: string;
  readonly keyVersion: number;
}): EncryptionEnvelope {
  if (!input.ciphertext.trim() || !input.nonce.trim()) {
    throw new InvalidSecurityEnvelopeError();
  }
  return {
    algorithm: ENCRYPTION_ALGORITHM,
    keyVersion: requireBoundedInt(input.keyVersion, 'keyVersion', 1, 10_000),
    ciphertext: input.ciphertext,
    nonce: input.nonce,
  };
}

export function parseEncryptionEnvelope(input: {
  readonly algorithm?: string;
  readonly keyVersion: number;
  readonly ciphertext: string;
  readonly nonce: string;
}): EncryptionEnvelope {
  if (input.algorithm) {
    parseEncryptionAlgorithm(input.algorithm);
  }
  return createEncryptionEnvelope(input);
}
