import type { RouteObject } from 'react-router-dom';

export const securityChildRoute: RouteObject = {
  path: 'security',
  lazy: async () => {
    const { SecurityPage } = await import('./pages/security-page');
    return { Component: SecurityPage };
  },
};
