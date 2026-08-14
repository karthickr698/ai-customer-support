export const AuditActions = {
  USER_REGISTERED: 'user.registered',
  LOGIN_SUCCEEDED: 'user.login.succeeded',
  LOGIN_FAILED: 'user.login.failed',
  LOGOUT: 'user.logout',
  TOKEN_REFRESHED: 'user.token.refreshed',
  TOKEN_REFRESH_REUSE_DETECTED: 'user.token.refresh_reuse_detected',
  EMAIL_VERIFICATION_SENT: 'user.email_verification.sent',
  EMAIL_VERIFIED: 'user.email_verified',
  PASSWORD_RESET_REQUESTED: 'user.password_reset.requested',
  PASSWORD_RESET_COMPLETED: 'user.password_reset.completed',
  GOOGLE_LOGIN_SUCCEEDED: 'user.oauth.google.login',
  GOOGLE_ACCOUNT_LINKED: 'user.oauth.google.linked',
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];
