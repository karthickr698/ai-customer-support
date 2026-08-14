import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type {
  AccessTokenClaims,
  IssuedAccessToken,
  TokenIssuerPort,
} from '../../../application/ports/token-issuer-port.js';

const ACCESS_TOKEN_TYPE = 'access';

export class JoseAccessTokenIssuer implements TokenIssuerPort {
  private readonly secret: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
  ) {
    this.secret = new TextEncoder().encode(secret);
  }

  async issueAccessToken(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const token = await new SignJWT({ email: claims.email, typ: ACCESS_TOKEN_TYPE })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(this.secret);

    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
      return readAccessClaims(payload);
    } catch {
      return null;
    }
  }
}

function readAccessClaims(payload: JWTPayload): AccessTokenClaims | null {
  if (payload.typ !== ACCESS_TOKEN_TYPE || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return null;
  }

  if (typeof payload.email !== 'string' || payload.email.length === 0) {
    return null;
  }

  return { userId: payload.sub, email: payload.email };
}
