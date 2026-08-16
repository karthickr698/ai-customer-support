import type { RouteObject } from 'react-router-dom';

export const notificationsChildRoute: RouteObject = {
  path: 'notifications',
  lazy: async () => {
    const { NotificationsLayout } = await import('./pages/notifications-layout');
    return { Component: NotificationsLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { NotificationInboxPage } = await import('./pages/inbox-page');
        return { Component: NotificationInboxPage };
      },
    },
    {
      path: 'preferences',
      lazy: async () => {
        const { NotificationPreferencesPage } = await import('./pages/preferences-page');
        return { Component: NotificationPreferencesPage };
      },
    },
  ],
};
