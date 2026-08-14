import type { RouteObject } from 'react-router-dom';
import { identityRoutes } from '@/features/identity/routes';
import { knowledgeRoutes } from '@/features/knowledge/routes';
import { organizationRoutes } from '@/features/organizations/routes';

export const featureRoutes: RouteObject[] = [
  ...identityRoutes,
  ...organizationRoutes,
  ...knowledgeRoutes,
  {
    path: 'dev/ui',
    lazy: async () => {
      if (!import.meta.env.DEV) {
        const { NotFound } = await import('./not-found');
        return { Component: NotFound };
      }

      const { DevUiPage } = await import('@/features/dev-ui/dev-ui-page');
      return { Component: DevUiPage };
    },
  },
];
