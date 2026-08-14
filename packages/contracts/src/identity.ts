export type AuthUserDto = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly emailVerified: boolean;
};

export type AuthUserResponse = {
  readonly user: AuthUserDto;
};

export type RegisterUserRequest = {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
};

export type LoginWithPasswordRequest = {
  readonly email: string;
  readonly password: string;
};

export type RequestPasswordResetRequest = {
  readonly email: string;
};

export type ResetPasswordRequest = {
  readonly token: string;
  readonly password: string;
};

export type VerifyEmailRequest = {
  readonly token: string;
};

export type ResendVerificationRequest = {
  readonly email: string;
};

export type CompleteOAuthLoginRequest = {
  readonly code: string;
};

export type GoogleAuthorizationResponse = {
  readonly authorizationUrl: string;
};

export type AuthMessageResponse = {
  readonly message: string;
};

export function isAuthUserDto(value: unknown): value is AuthUserDto {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.email === 'string' &&
    typeof record.displayName === 'string' &&
    typeof record.emailVerified === 'boolean'
  );
}

export function isAuthUserResponse(value: unknown): value is AuthUserResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isAuthUserDto(record.user);
}
