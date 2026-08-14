import type { AuthUserDto } from '@ai-customer-support/contracts';
import type { User } from '../domain/user.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
};

export type AuthSessionResult = {
  readonly user: AuthUserDto;
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshSessionId: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshTokenExpiresAt: Date;
};

export function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    email: user.email.value,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  };
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
