import type { RouteObject } from 'react-router-dom';

export const integrationsChildRoute: RouteObject = {
  path: 'integrations',
  lazy: async () => {
    const { IntegrationsLayout } = await import('./pages/integrations-layout');
    return { Component: IntegrationsLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { IntegrationsIndexPage } = await import('./pages/integrations-index-page');
        return { Component: IntegrationsIndexPage };
      },
    },
    {
      path: 'customers',
      lazy: async () => {
        const { IntegrationCustomersPage } = await import('./pages/customers-page');
        return { Component: IntegrationCustomersPage };
      },
    },
    {
      path: 'products',
      lazy: async () => {
        const { IntegrationProductsPage } = await import('./pages/products-page');
        return { Component: IntegrationProductsPage };
      },
    },
    {
      path: 'orders',
      lazy: async () => {
        const { IntegrationOrdersPage } = await import('./pages/orders-page');
        return { Component: IntegrationOrdersPage };
      },
    },
    {
      path: 'returns',
      lazy: async () => {
        const { IntegrationReturnsPage } = await import('./pages/returns-page');
        return { Component: IntegrationReturnsPage };
      },
    },
    {
      path: 'shipping',
      lazy: async () => {
        const { IntegrationShippingPage } = await import('./pages/shipping-page');
        return { Component: IntegrationShippingPage };
      },
    },
  ],
};
