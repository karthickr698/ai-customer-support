export type NotificationTemplateId = string & { readonly __brand: 'NotificationTemplateId' };
export type NotificationPreferenceId = string & { readonly __brand: 'NotificationPreferenceId' };
export type NotificationDeliveryId = string & { readonly __brand: 'NotificationDeliveryId' };
export type NotificationAttemptId = string & { readonly __brand: 'NotificationAttemptId' };
export type NotificationInboxItemId = string & { readonly __brand: 'NotificationInboxItemId' };

export function createNotificationTemplateId(id: string = crypto.randomUUID()): NotificationTemplateId {
  return id as NotificationTemplateId;
}

export function createNotificationPreferenceId(
  id: string = crypto.randomUUID(),
): NotificationPreferenceId {
  return id as NotificationPreferenceId;
}

export function createNotificationDeliveryId(id: string = crypto.randomUUID()): NotificationDeliveryId {
  return id as NotificationDeliveryId;
}

export function createNotificationAttemptId(id: string = crypto.randomUUID()): NotificationAttemptId {
  return id as NotificationAttemptId;
}

export function createNotificationInboxItemId(
  id: string = crypto.randomUUID(),
): NotificationInboxItemId {
  return id as NotificationInboxItemId;
}
