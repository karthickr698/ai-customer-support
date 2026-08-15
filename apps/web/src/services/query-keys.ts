export const queryKeys = {
  health: {
    all: () => ['health'] as const,
    live: () => [...queryKeys.health.all(), 'live'] as const,
    ready: () => [...queryKeys.health.all(), 'ready'] as const,
  },
  conversations: {
    all: () => ['conversations'] as const,
    list: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.conversations.all(), organizationId, 'list', filters] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.conversations.all(), organizationId, 'detail', id] as const,
    messages: (organizationId: string, id: string) =>
      [...queryKeys.conversations.all(), organizationId, id, 'messages'] as const,
    notes: (organizationId: string, id: string) =>
      [...queryKeys.conversations.all(), organizationId, id, 'notes'] as const,
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
    documents: (organizationId: string) => [...queryKeys.knowledge.all(), organizationId, 'documents'] as const,
    detail: (id: string) => [...queryKeys.knowledge.all(), 'detail', id] as const,
  },
  organizations: {
    all: () => ['organizations'] as const,
    list: () => [...queryKeys.organizations.all(), 'list'] as const,
    detail: (id: string) => [...queryKeys.organizations.all(), 'detail', id] as const,
    members: (id: string) => [...queryKeys.organizations.all(), id, 'members'] as const,
    invitations: (id: string) => [...queryKeys.organizations.all(), id, 'invitations'] as const,
    auditLogs: (id: string) => [...queryKeys.organizations.all(), id, 'audit-logs'] as const,
    auditLogPage: (id: string, page: number) => [...queryKeys.organizations.auditLogs(id), page] as const,
  },
  onboarding: {
    all: () => ['onboarding'] as const,
    detail: (organizationId: string) => [...queryKeys.onboarding.all(), organizationId] as const,
  },
  widget: {
    all: () => ['widget'] as const,
    detail: (organizationId: string) => [...queryKeys.widget.all(), organizationId] as const,
  },
} as const;
