import type { RouteObject } from 'react-router-dom';

export const knowledgeChildRoute: RouteObject = {
  path: 'knowledge',
  lazy: async () => {
    const { KnowledgePage } = await import('./pages/knowledge-page');
    return { Component: KnowledgePage };
  },
};
