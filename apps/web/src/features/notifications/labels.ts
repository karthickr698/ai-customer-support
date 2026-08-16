import type { NotificationChannel, NotificationEventType } from '@ai-customer-support/contracts';
import { workspacePath } from '@/features/organizations/workspace-paths';

export function notificationsPath(organizationId: string, segment = ''): string {
  const base = `/organizations/${organizationId}/notifications`;
  return segment ? `${base}/${segment}` : base;
}

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  in_app: 'In-app',
  sms: 'SMS',
  webhook: 'Webhook',
};

export const PREFERENCE_EVENTS: readonly NotificationEventType[] = [
  'TicketCreated',
  'TicketAssigned',
  'TicketEscalated',
  'TicketSlaBreached',
  'ConversationEscalated',
  'AgentAssigned',
  'MessageReceived',
];

export function notificationDeepLink(organizationId: string, eventType: string): string {
  if (eventType.startsWith('Ticket')) {
    return workspacePath(organizationId, 'tickets');
  }
  if (
    eventType.startsWith('Conversation') ||
    eventType.startsWith('Message') ||
    eventType === 'AgentAssigned' ||
    eventType === 'AgentUnassigned'
  ) {
    return workspacePath(organizationId, 'inbox');
  }
  if (eventType.startsWith('Customer') || eventType.startsWith('Order') || eventType.startsWith('Product')) {
    return workspacePath(organizationId, 'integrations/customers');
  }
  if (eventType.startsWith('Knowledge')) {
    return workspacePath(organizationId, 'knowledge');
  }
  if (eventType.startsWith('Widget')) {
    return workspacePath(organizationId, 'widget');
  }
  return notificationsPath(organizationId);
}
