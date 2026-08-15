import type { RouteObject } from 'react-router-dom';

export const conversationsChildRoute: RouteObject = {
  path: 'inbox',
  children: [
    {
      index: true,
      lazy: async () => {
        const { InboxPage } = await import('./pages/inbox-page');
        return { Component: InboxPage };
      },
    },
    {
      path: ':conversationId',
      lazy: async () => {
        const { InboxPage } = await import('./pages/inbox-page');
        return { Component: InboxPage };
      },
    },
  ],
};
