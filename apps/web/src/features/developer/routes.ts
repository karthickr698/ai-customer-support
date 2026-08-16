import type { RouteObject } from 'react-router-dom';

export function developerPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/developers`;
  return segment ? `${base}/${segment}` : base;
}

export const developerChildRoute: RouteObject = {
  path: 'developers',
  lazy: async () => {
    const { DeveloperLayout } = await import('./pages/developer-layout');
    return { Component: DeveloperLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { DeveloperDocsPage } = await import('./pages/docs-page');
        return { Component: DeveloperDocsPage };
      },
    },
    {
      path: 'keys',
      lazy: async () => {
        const { DeveloperKeysPage } = await import('./pages/keys-page');
        return { Component: DeveloperKeysPage };
      },
    },
    {
      path: 'webhooks',
      lazy: async () => {
        const { DeveloperWebhooksPage } = await import('./pages/webhooks-page');
        return { Component: DeveloperWebhooksPage };
      },
    },
    {
      path: 'sandbox',
      lazy: async () => {
        const { DeveloperSandboxPage } = await import('./pages/sandbox-page');
        return { Component: DeveloperSandboxPage };
      },
    },
  ],
};
