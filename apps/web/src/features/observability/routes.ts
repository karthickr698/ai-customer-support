import type { RouteObject } from 'react-router-dom';

export const observabilityChildRoute: RouteObject = {
  path: 'observability',
  lazy: async () => {
    const { ObservabilityLayout } = await import('./pages/observability-layout');
    return { Component: ObservabilityLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { ObservabilityOverviewPage } = await import('./pages/overview-page');
        return { Component: ObservabilityOverviewPage };
      },
    },
    {
      path: 'logs',
      lazy: async () => {
        const { ObservabilityLogsPage } = await import('./pages/logs-page');
        return { Component: ObservabilityLogsPage };
      },
    },
    {
      path: 'traces',
      lazy: async () => {
        const { ObservabilityTracesPage } = await import('./pages/traces-page');
        return { Component: ObservabilityTracesPage };
      },
    },
    {
      path: 'incidents',
      lazy: async () => {
        const { ObservabilityIncidentsPage } = await import('./pages/incidents-page');
        return { Component: ObservabilityIncidentsPage };
      },
    },
    {
      path: 'evaluations',
      lazy: async () => {
        const { ObservabilityEvaluationsPage } = await import('./pages/evaluations-page');
        return { Component: ObservabilityEvaluationsPage };
      },
    },
  ],
};
