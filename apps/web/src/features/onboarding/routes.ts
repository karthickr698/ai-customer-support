import type { RouteObject } from 'react-router-dom';

export const onboardingRoutes: RouteObject[] = [
  {
    path: 'organizations/:organizationId/onboarding',
    lazy: async () => {
      const { OnboardingPage } = await import('./pages/onboarding-page');
      return { Component: OnboardingPage };
    },
  },
];
