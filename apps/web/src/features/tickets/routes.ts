import type { RouteObject } from 'react-router-dom';

export const ticketsChildRoute: RouteObject = {
  path: 'tickets',
  lazy: async () => {
    const { TicketsLayout } = await import('./pages/tickets-layout');
    return { Component: TicketsLayout };
  },
  children: [
    {
      index: true,
      lazy: async () => {
        const { TicketQueuePage } = await import('./pages/queue-page');
        return { Component: TicketQueuePage };
      },
    },
    {
      path: 'policies',
      lazy: async () => {
        const { TicketPoliciesPage } = await import('./pages/policies-page');
        return { Component: TicketPoliciesPage };
      },
    },
    {
      path: ':ticketId',
      lazy: async () => {
        const { TicketQueuePage } = await import('./pages/queue-page');
        return { Component: TicketQueuePage };
      },
    },
  ],
};
