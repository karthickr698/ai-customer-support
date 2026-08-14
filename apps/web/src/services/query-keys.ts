export const queryKeys = {
  health: {
    all: () => ['health'] as const,
    live: () => [...queryKeys.health.all(), 'live'] as const,
    ready: () => [...queryKeys.health.all(), 'ready'] as const,
  },
  conversations: {
    all: () => ['conversations'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.conversations.all(), 'list', filters] as const,
    detail: (id: string) => [...queryKeys.conversations.all(), 'detail', id] as const,
  },
  tickets: {
    all: () => ['tickets'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.tickets.all(), 'list', filters] as const,
    detail: (id: string) => [...queryKeys.tickets.all(), 'detail', id] as const,
  },
  customers: {
    all: () => ['customers'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.customers.all(), 'list', filters] as const,
    detail: (id: string) => [...queryKeys.customers.all(), 'detail', id] as const,
  },
  knowledge: {
    all: () => ['knowledge'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.knowledge.all(), 'list', filters] as const,
    detail: (id: string) => [...queryKeys.knowledge.all(), 'detail', id] as const,
  },
} as const;
