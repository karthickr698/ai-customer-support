import type { RouteObject } from 'react-router-dom';

export const automationsChildRoute: RouteObject = {
  path: 'automations',
  lazy: async () => {
    const { AutomationsLayout } = await import('./pages/automations-layout');
    return { Component: AutomationsLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { AutomationsIndexPage } = await import('./pages/automations-index-page');
        return { Component: AutomationsIndexPage };
      },
    },
    {
      path: 'new',
      lazy: async () => {
        const { WorkflowBuilderPage } = await import('./pages/workflow-builder-page');
        return { Component: WorkflowBuilderPage };
      },
    },
    {
      path: 'history',
      lazy: async () => {
        const { AutomationHistoryPage } = await import('./pages/history-page');
        return { Component: AutomationHistoryPage };
      },
    },
    {
      path: ':ruleId/history',
      lazy: async () => {
        const { AutomationHistoryPage } = await import('./pages/history-page');
        return { Component: AutomationHistoryPage };
      },
    },
    {
      path: ':ruleId',
      lazy: async () => {
        const { WorkflowBuilderPage } = await import('./pages/workflow-builder-page');
        return { Component: WorkflowBuilderPage };
      },
    },
  ],
};
