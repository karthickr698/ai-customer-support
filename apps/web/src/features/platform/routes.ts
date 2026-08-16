import type { RouteObject } from 'react-router-dom';

export const platformRoutes: RouteObject[] = [
  {
    path: 'platform',
    lazy: async () => {
      const { PlatformLayout } = await import('./pages/platform-layout');
      return { Component: PlatformLayout };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { PlatformHealthPage } = await import('./pages/health-page');
          return { Component: PlatformHealthPage };
        },
      },
      {
        path: 'tenants',
        lazy: async () => {
          const { PlatformTenantsPage } = await import('./pages/tenants-page');
          return { Component: PlatformTenantsPage };
        },
      },
      {
        path: 'operators',
        lazy: async () => {
          const { PlatformOperatorsPage } = await import('./pages/operators-page');
          return { Component: PlatformOperatorsPage };
        },
      },
      {
        path: 'plans',
        lazy: async () => {
          const { PlatformPlansPage } = await import('./pages/plans-page');
          return { Component: PlatformPlansPage };
        },
      },
      {
        path: 'incidents',
        lazy: async () => {
          const { PlatformIncidentsPage } = await import('./pages/incidents-page');
          return { Component: PlatformIncidentsPage };
        },
      },
      {
        path: 'usage',
        lazy: async () => {
          const { PlatformUsagePage } = await import('./pages/usage-page');
          return { Component: PlatformUsagePage };
        },
      },
      {
        path: 'audit',
        lazy: async () => {
          const { PlatformAuditPage } = await import('./pages/audit-page');
          return { Component: PlatformAuditPage };
        },
      },
    ],
  },
];
