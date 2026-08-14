import type {
  AuthMessageResponse,
  AuthUserDto,
  AuthUserResponse,
  CompleteOAuthLoginRequest,
  GoogleAuthorizationResponse,
  LoginWithPasswordRequest,
  RegisterUserRequest,
  RequestPasswordResetRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@ai-customer-support/contracts';
import { apiClient } from '@/services/api-client';

export const identityApi = {
  register: (body: RegisterUserRequest) =>
    apiClient.post<AuthUserResponse & AuthMessageResponse>('/api/auth/register', body),
  login: (body: LoginWithPasswordRequest) =>
    apiClient.post<AuthUserResponse>('/api/auth/login', body),
  logout: () => apiClient.post<void>('/api/auth/logout'),
  me: () => apiClient.get<AuthUserResponse>('/api/auth/me'),
  refresh: () => apiClient.post<AuthUserResponse>('/api/auth/refresh'),
  forgotPassword: (body: RequestPasswordResetRequest) =>
    apiClient.post<AuthMessageResponse>('/api/auth/password/forgot', body),
  resetPassword: (body: ResetPasswordRequest) =>
    apiClient.post<AuthMessageResponse>('/api/auth/password/reset', body),
  verifyEmail: (body: VerifyEmailRequest) =>
    apiClient.post<AuthUserResponse>('/api/auth/email/verify', body),
  resendVerification: (body: ResendVerificationRequest) =>
    apiClient.post<AuthMessageResponse>('/api/auth/email/resend', body),
  startGoogle: () => apiClient.post<GoogleAuthorizationResponse>('/api/auth/google/start'),
  completeGoogle: (body: CompleteOAuthLoginRequest) =>
    apiClient.post<AuthUserResponse>('/api/auth/google/complete', body),
};

export type { AuthUserDto };
