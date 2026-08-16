import type { RouteObject } from 'react-router-dom';

export const analyticsChildRoute: RouteObject = {
  path: 'analytics',
  lazy: async () => {
    const { AnalyticsLayout } = await import('./pages/analytics-layout');
    return { Component: AnalyticsLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { AnalyticsOverviewPage } = await import('./pages/overview-page');
        return { Component: AnalyticsOverviewPage };
      },
    },
    {
      path: 'conversations',
      lazy: async () => {
        const { ConversationAnalyticsPage } = await import('./pages/conversations-page');
        return { Component: ConversationAnalyticsPage };
      },
    },
    {
      path: 'tickets',
      lazy: async () => {
        const { TicketAnalyticsPage } = await import('./pages/tickets-page');
        return { Component: TicketAnalyticsPage };
      },
    },
    {
      path: 'agents',
      lazy: async () => {
        const { AgentAnalyticsPage } = await import('./pages/agents-page');
        return { Component: AgentAnalyticsPage };
      },
    },
    {
      path: 'customers',
      lazy: async () => {
        const { CustomerAnalyticsPage } = await import('./pages/customers-page');
        return { Component: CustomerAnalyticsPage };
      },
    },
  ],
};
