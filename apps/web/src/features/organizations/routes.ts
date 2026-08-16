import type { RouteObject } from 'react-router-dom';
import { knowledgeChildRoute } from '@/features/knowledge/routes';
import { conversationsChildRoute } from '@/features/conversations/routes';
import { onboardingChildRoute } from '@/features/onboarding/routes';
import { agentConfigurationChildRoute } from '@/features/agent-configuration/routes';
import { integrationsChildRoute } from '@/features/integrations/routes';
import { toolsChildRoute } from '@/features/tools/routes';
import { widgetChildRoute } from '@/features/widget/routes';

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
      const { WorkspaceLayout } = await import('./layouts/workspace-layout');
      return { Component: WorkspaceLayout };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { OrganizationIndexRedirect } = await import('./pages/organization-index-redirect');
          return { Component: OrganizationIndexRedirect };
        },
      },
      {
        path: 'members',
        lazy: async () => {
          const { MembersPage } = await import('./pages/members-page');
          return { Component: MembersPage };
        },
      },
      {
        path: 'invitations',
        lazy: async () => {
          const { InvitationsPage } = await import('./pages/invitations-page');
          return { Component: InvitationsPage };
        },
      },
      {
        path: 'roles',
        lazy: async () => {
          const { RolesPage } = await import('./pages/roles-page');
          return { Component: RolesPage };
        },
      },
      {
        path: 'settings',
        lazy: async () => {
          const { WorkspaceSettingsPage } = await import('./pages/workspace-settings-page');
          return { Component: WorkspaceSettingsPage };
        },
      },
      {
        path: 'audit',
        lazy: async () => {
          const { AuditLogPage } = await import('./pages/audit-log-page');
          return { Component: AuditLogPage };
        },
      },
      conversationsChildRoute,
      knowledgeChildRoute,
      onboardingChildRoute,
      agentConfigurationChildRoute,
      integrationsChildRoute,
      toolsChildRoute,
      widgetChildRoute,
    ],
  },
  {
    path: 'invitations/accept',
    lazy: async () => {
      const { AcceptInvitationPage } = await import('./pages/accept-invitation-page');
      return { Component: AcceptInvitationPage };
    },
  },
];
