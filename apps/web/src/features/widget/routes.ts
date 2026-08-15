import type { RouteObject } from 'react-router-dom';

export const widgetChildRoute: RouteObject = {
  path: 'widget',
  lazy: async () => {
    const { WidgetSettingsPage } = await import('./pages/widget-settings-page');
    return { Component: WidgetSettingsPage };
  },
};
