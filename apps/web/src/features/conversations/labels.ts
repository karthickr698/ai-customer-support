import type {
  ConversationChannel,
  ConversationPriority,
  ConversationStatus,
  MessageAuthorType,
} from '@ai-customer-support/contracts';

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
  escalated: 'Escalated',
};

export const PRIORITY_LABELS: Record<ConversationPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  web: 'Web',
  email: 'Email',
  api: 'API',
  widget: 'Widget',
};

export const AUTHOR_LABELS: Record<MessageAuthorType, string> = {
  customer: 'Customer',
  agent: 'Agent',
  system: 'System',
  ai: 'AI assistant',
};

export const INBOX_STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const PRIORITY_OPTIONS: ReadonlyArray<{ value: ConversationPriority; label: string }> = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export const CHANNEL_OPTIONS: ReadonlyArray<{ value: ConversationChannel; label: string }> = [
  { value: 'widget', label: 'Widget' },
  { value: 'email', label: 'Email' },
  { value: 'web', label: 'Web' },
  { value: 'api', label: 'API' },
];

export const AGENT_STATUS_OPTIONS: ReadonlyArray<{
  value: Exclude<ConversationStatus, 'escalated'>;
  label: string;
}> = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
