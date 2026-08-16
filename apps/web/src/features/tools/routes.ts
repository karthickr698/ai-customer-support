import type { RouteObject } from 'react-router-dom';

export const toolsChildRoute: RouteObject = {
  path: 'tools',
  lazy: async () => {
    const { ToolsLayout } = await import('./pages/tools-layout');
    return { Component: ToolsLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { ToolsCatalogPage } = await import('./pages/catalog-page');
        return { Component: ToolsCatalogPage };
      },
    },
    {
      path: 'credentials',
      lazy: async () => {
        const { ToolsCredentialsPage } = await import('./pages/credentials-page');
        return { Component: ToolsCredentialsPage };
      },
    },
    {
      path: 'oauth',
      lazy: async () => {
        const { ToolsOAuthPage } = await import('./pages/oauth-page');
        return { Component: ToolsOAuthPage };
      },
    },
    {
      path: 'test',
      lazy: async () => {
        const { ToolsTesterPage } = await import('./pages/tester-page');
        return { Component: ToolsTesterPage };
      },
    },
    {
      path: 'invocations',
      lazy: async () => {
        const { ToolsInvocationsPage } = await import('./pages/invocations-page');
        return { Component: ToolsInvocationsPage };
      },
    },
  ],
};
