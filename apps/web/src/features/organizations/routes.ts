import type { RouteObject } from 'react-router-dom';

export const organizationRoutes: RouteObject[] = [
  {
    path: 'organizations',
    lazy: async () => {
      const { OrganizationsPage } = await import('./pages/organizations-page');
      return { Component: OrganizationsPage };
    },
  },
  {
    path: 'organizations/:organizationId',
    lazy: async () => {
      const { OrganizationDetailPage } = await import('./pages/organization-detail-page');
      return { Component: OrganizationDetailPage };
    },
  },
  {
    path: 'invitations/accept',
    lazy: async () => {
      const { AcceptInvitationPage } = await import('./pages/accept-invitation-page');
      return { Component: AcceptInvitationPage };
    },
  },
];
