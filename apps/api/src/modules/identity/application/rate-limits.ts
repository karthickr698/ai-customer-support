export const AUTH_RATE_LIMITS = {
  loginIp: { limit: 20, windowSeconds: 15 * 60 },
  loginEmail: { limit: 5, windowSeconds: 15 * 60 },
  registerIp: { limit: 5, windowSeconds: 60 * 60 },
  passwordResetIp: { limit: 10, windowSeconds: 60 * 60 },
  passwordResetEmail: { limit: 3, windowSeconds: 60 * 60 },
  verifyIp: { limit: 10, windowSeconds: 60 * 60 },
  resendVerificationIp: { limit: 5, windowSeconds: 60 * 60 },
  resendVerificationEmail: { limit: 3, windowSeconds: 60 * 60 },
  refreshIp: { limit: 60, windowSeconds: 60 },
  googleStartIp: { limit: 20, windowSeconds: 15 * 60 },
  googleCompleteIp: { limit: 20, windowSeconds: 15 * 60 },
  oauthExchangeIp: { limit: 20, windowSeconds: 15 * 60 },
} as const;

export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
export const OAUTH_LOGIN_CODE_TTL_SECONDS = 60;
