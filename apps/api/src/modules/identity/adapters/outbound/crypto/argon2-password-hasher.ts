import argon2 from 'argon2';
import type { PasswordHasherPort } from '../../../application/ports/password-hasher-port.js';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$qUra6wsMUuoMdpn/ptUNnA$z1gyY/7q0yciRMfOpxVBgmn3WWz8H1zCTyrIi2lnIn0';

export class Argon2PasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  dummyHash(): string {
    return DUMMY_PASSWORD_HASH;
  }
}
