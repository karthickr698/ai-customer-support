import { PLATFORM_FEATURE_FLAG_KEYS } from '@ai-customer-support/contracts';

export type DefaultFeatureFlagDefinition = {
  readonly key: string;
  readonly description: string;
  readonly enabled: boolean;
};

const DESCRIPTIONS: Record<(typeof PLATFORM_FEATURE_FLAG_KEYS)[number], string> = {
  ai_replies: 'AI-generated customer replies and orchestration',
  widget: 'Public chat widget embed and sessions',
  public_api: 'Versioned public REST API, keys, and webhooks',
  billing: 'Subscription billing, usage, and invoices',
  knowledge_ingestion: 'Knowledge document upload and RAG indexing',
  automations: 'Event and schedule automation rules',
  notifications: 'Outbound notification delivery',
  analytics: 'Tenant analytics reports and exports',
};

export const DEFAULT_FEATURE_FLAGS: readonly DefaultFeatureFlagDefinition[] = PLATFORM_FEATURE_FLAG_KEYS.map(
  (key) => ({
    key,
    description: DESCRIPTIONS[key],
    enabled: true,
  }),
);
