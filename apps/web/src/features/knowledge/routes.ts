import type { RouteObject } from 'react-router-dom';

export const knowledgeRoutes: RouteObject[] = [
  {
    path: 'organizations/:organizationId/knowledge',
    lazy: async () => {
      const { KnowledgePage } = await import('./pages/knowledge-page');
      return { Component: KnowledgePage };
    },
  },
];
