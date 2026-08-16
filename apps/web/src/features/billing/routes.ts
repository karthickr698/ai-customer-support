import type { RouteObject } from 'react-router-dom';

export const billingChildRoute: RouteObject = {
  path: 'billing',
  lazy: async () => {
    const { BillingPage } = await import('./pages/billing-page');
    return { Component: BillingPage };
  },
};
