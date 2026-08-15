import type { RouteObject } from 'react-router-dom';

export const onboardingChildRoute: RouteObject = {
  path: 'onboarding',
  lazy: async () => {
    const { OnboardingPage } = await import('./pages/onboarding-page');
    return { Component: OnboardingPage };
  },
};
