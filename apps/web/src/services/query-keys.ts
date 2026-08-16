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
  agents: {
    all: () => ['agents'] as const,
    presence: (organizationId: string) => [...queryKeys.agents.all(), organizationId, 'presence'] as const,
  },
  tickets: {
    all: () => ['tickets'] as const,
    list: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.tickets.all(), organizationId, 'list', filters] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.tickets.all(), organizationId, 'detail', id] as const,
    notes: (organizationId: string, id: string) =>
      [...queryKeys.tickets.all(), organizationId, id, 'notes'] as const,
    slaPolicies: (organizationId: string) =>
      [...queryKeys.tickets.all(), organizationId, 'sla-policies'] as const,
    escalationPolicies: (organizationId: string) =>
      [...queryKeys.tickets.all(), organizationId, 'escalation-policies'] as const,
  },
  customers: {
    all: () => ['customers'] as const,
    list: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.customers.all(), organizationId, 'list', filters] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.customers.all(), organizationId, 'detail', id] as const,
  },
  products: {
    all: () => ['products'] as const,
    list: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.products.all(), organizationId, 'list', filters] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.products.all(), organizationId, 'detail', id] as const,
  },
  orders: {
    all: () => ['orders'] as const,
    list: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.orders.all(), organizationId, 'list', filters] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.orders.all(), organizationId, 'detail', id] as const,
  },
  shipments: {
    all: () => ['shipments'] as const,
    list: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.shipments.all(), organizationId, 'list', filters] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.shipments.all(), organizationId, 'detail', id] as const,
  },
  returns: {
    all: () => ['returns'] as const,
    list: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.returns.all(), organizationId, 'list', filters] as const,
    detail: (organizationId: string, id: string) =>
      [...queryKeys.returns.all(), organizationId, 'detail', id] as const,
  },
  knowledge: {
    all: () => ['knowledge'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.knowledge.all(), 'list', filters] as const,
    documents: (organizationId: string) => [...queryKeys.knowledge.all(), organizationId, 'documents'] as const,
    detail: (id: string) => [...queryKeys.knowledge.all(), 'detail', id] as const,
    articles: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.knowledge.all(), organizationId, 'articles', filters] as const,
    article: (organizationId: string, articleId: string) =>
      [...queryKeys.knowledge.all(), organizationId, 'article', articleId] as const,
    articleVersions: (organizationId: string, articleId: string) =>
      [...queryKeys.knowledge.all(), organizationId, 'article', articleId, 'versions'] as const,
    categories: (organizationId: string) => [...queryKeys.knowledge.all(), organizationId, 'categories'] as const,
    tags: (organizationId: string) => [...queryKeys.knowledge.all(), organizationId, 'tags'] as const,
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
  agentConfiguration: {
    all: () => ['agent-configuration'] as const,
    detail: (organizationId: string) => [...queryKeys.agentConfiguration.all(), organizationId] as const,
  },
  tools: {
    all: () => ['tools'] as const,
    catalog: (organizationId: string) => [...queryKeys.tools.all(), organizationId, 'catalog'] as const,
    credentials: (organizationId: string) => [...queryKeys.tools.all(), organizationId, 'credentials'] as const,
    oauth: (organizationId: string) => [...queryKeys.tools.all(), organizationId, 'oauth'] as const,
    connectorCatalog: (organizationId: string) =>
      [...queryKeys.tools.all(), organizationId, 'connector-catalog'] as const,
    invocations: (organizationId: string, page: number) =>
      [...queryKeys.tools.all(), organizationId, 'invocations', page] as const,
  },
  automations: {
    all: () => ['automations'] as const,
    rules: (organizationId: string) => [...queryKeys.automations.all(), organizationId, 'rules'] as const,
    rule: (organizationId: string, ruleId: string) =>
      [...queryKeys.automations.all(), organizationId, 'rule', ruleId] as const,
    jobs: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.automations.all(), organizationId, 'jobs', filters] as const,
    logs: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.automations.all(), organizationId, 'logs', filters] as const,
  },
  integrations: {
    all: () => ['integrations'] as const,
    catalog: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.integrations.all(), organizationId, 'catalog', filters] as const,
    catalogItem: (organizationId: string, catalogId: string) =>
      [...queryKeys.integrations.all(), organizationId, 'catalog', catalogId] as const,
    connections: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.integrations.all(), organizationId, 'connections', filters] as const,
    connection: (organizationId: string, connectionId: string) =>
      [...queryKeys.integrations.all(), organizationId, 'connection', connectionId] as const,
  },
  analytics: {
    all: () => ['analytics'] as const,
    overview: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all(), organizationId, 'overview', filters] as const,
    timeseries: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all(), organizationId, 'timeseries', filters] as const,
    conversations: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all(), organizationId, 'conversations', filters] as const,
    tickets: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all(), organizationId, 'tickets', filters] as const,
    agents: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all(), organizationId, 'agents', filters] as const,
    customers: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.analytics.all(), organizationId, 'customers', filters] as const,
  },
  notifications: {
    all: () => ['notifications'] as const,
    inbox: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.notifications.all(), organizationId, 'inbox', filters] as const,
    preferences: (organizationId: string) =>
      [...queryKeys.notifications.all(), organizationId, 'preferences'] as const,
  },
  billing: {
    all: () => ['billing'] as const,
    plans: () => [...queryKeys.billing.all(), 'plans'] as const,
    subscription: (organizationId: string) =>
      [...queryKeys.billing.all(), organizationId, 'subscription'] as const,
    usage: (organizationId: string) => [...queryKeys.billing.all(), organizationId, 'usage'] as const,
    invoices: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.billing.all(), organizationId, 'invoices', filters] as const,
    paymentMethods: (organizationId: string) =>
      [...queryKeys.billing.all(), organizationId, 'payment-methods'] as const,
  },
  security: {
    all: () => ['security'] as const,
    policy: (organizationId: string) => [...queryKeys.security.all(), organizationId, 'policy'] as const,
    rateLimits: (organizationId: string) => [...queryKeys.security.all(), organizationId, 'rate-limits'] as const,
    ipAllowlist: (organizationId: string) => [...queryKeys.security.all(), organizationId, 'ip-allowlist'] as const,
    secrets: (organizationId: string) => [...queryKeys.security.all(), organizationId, 'secrets'] as const,
    apiKeys: (organizationId: string) => [...queryKeys.security.all(), organizationId, 'api-keys'] as const,
    oauthApps: (organizationId: string) => [...queryKeys.security.all(), organizationId, 'oauth-apps'] as const,
    audit: (organizationId: string, page: number) =>
      [...queryKeys.security.all(), organizationId, 'audit', page] as const,
  },
  developer: {
    all: () => ['developer'] as const,
    version: () => [...queryKeys.developer.all(), 'version'] as const,
    session: (organizationId: string) => [...queryKeys.developer.all(), organizationId, 'session'] as const,
    keys: (organizationId: string) => [...queryKeys.developer.all(), organizationId, 'keys'] as const,
    webhooks: (organizationId: string) => [...queryKeys.developer.all(), organizationId, 'webhooks'] as const,
    deliveries: (organizationId: string, webhookId: string) =>
      [...queryKeys.developer.all(), organizationId, 'deliveries', webhookId] as const,
    usage: (organizationId: string) => [...queryKeys.developer.all(), organizationId, 'usage'] as const,
  },
  platform: {
    all: () => ['platform'] as const,
    me: () => [...queryKeys.platform.all(), 'me'] as const,
    operators: () => [...queryKeys.platform.all(), 'operators'] as const,
    tenants: (filters?: Record<string, unknown>) => [...queryKeys.platform.all(), 'tenants', filters] as const,
    flags: () => [...queryKeys.platform.all(), 'flags'] as const,
    health: () => [...queryKeys.platform.all(), 'health'] as const,
    audit: (filters?: Record<string, unknown>) => [...queryKeys.platform.all(), 'audit', filters] as const,
    incidents: (filters?: Record<string, unknown>) => [...queryKeys.platform.all(), 'incidents', filters] as const,
    usage: () => [...queryKeys.platform.all(), 'usage'] as const,
    plans: () => [...queryKeys.platform.all(), 'plans'] as const,
  },
  observability: {
    all: () => ['observability'] as const,
    overview: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.observability.all(), organizationId, 'overview', filters] as const,
    logs: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.observability.all(), organizationId, 'logs', filters] as const,
    traces: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.observability.all(), organizationId, 'traces', filters] as const,
    metrics: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.observability.all(), organizationId, 'metrics', filters] as const,
    incidents: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.observability.all(), organizationId, 'incidents', filters] as const,
    evaluations: (organizationId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.observability.all(), organizationId, 'evaluations', filters] as const,
  },
  featureFlags: {
    all: () => ['feature-flags'] as const,
    evaluation: (key: string, organizationId?: string) =>
      [...queryKeys.featureFlags.all(), key, organizationId] as const,
  },
} as const;
