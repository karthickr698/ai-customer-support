import type { RouteObject } from 'react-router-dom';

export const integrationsChildRoute: RouteObject = {
  path: 'integrations',
  lazy: async () => {
    const { IntegrationsMarketplacePage } = await import('./pages/marketplace-page');
    return { Component: IntegrationsMarketplacePage };
  },
};
