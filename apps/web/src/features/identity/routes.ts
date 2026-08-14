import type { RouteObject } from 'react-router-dom';

export const identityRoutes: RouteObject[] = [
  {
    path: 'login',
    lazy: async () => {
      const { LoginPage } = await import('./pages/login-page');
      return { Component: LoginPage };
    },
  },
  {
    path: 'register',
    lazy: async () => {
      const { RegisterPage } = await import('./pages/register-page');
      return { Component: RegisterPage };
    },
  },
  {
    path: 'forgot-password',
    lazy: async () => {
      const { ForgotPasswordPage } = await import('./pages/forgot-password-page');
      return { Component: ForgotPasswordPage };
    },
  },
  {
    path: 'reset-password',
    lazy: async () => {
      const { ResetPasswordPage } = await import('./pages/reset-password-page');
      return { Component: ResetPasswordPage };
    },
  },
  {
    path: 'verify-email',
    lazy: async () => {
      const { VerifyEmailPage } = await import('./pages/verify-email-page');
      return { Component: VerifyEmailPage };
    },
  },
  {
    path: 'auth/callback',
    lazy: async () => {
      const { GoogleCallbackPage } = await import('./pages/google-callback-page');
      return { Component: GoogleCallbackPage };
    },
  },
];
