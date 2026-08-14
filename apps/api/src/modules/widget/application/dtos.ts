import type {
  PublicWidgetConfigurationDto,
  WidgetConfigurationDto,
  WidgetSessionDto,
} from '@ai-customer-support/contracts';
import type { WidgetConfiguration } from '../domain/widget-configuration.js';
import type { WidgetSession } from '../domain/widget-session.js';

export type RequestSecurityContext = {
  readonly ipAddress: string;
  readonly userAgent?: string;
  readonly requestId: string;
  readonly correlationId?: string;
  readonly origin?: string;
};

export function toWidgetConfigurationDto(widget: WidgetConfiguration): WidgetConfigurationDto {
  const snapshot = widget.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    publicKey: snapshot.publicKey,
    enabled: snapshot.enabled,
    title: snapshot.title,
    greeting: snapshot.greeting,
    primaryColor: snapshot.primaryColor,
    position: snapshot.position,
    launcherText: snapshot.launcherText,
    collectEmail: snapshot.collectEmail,
    allowAnonymous: snapshot.allowAnonymous,
    allowAttachments: snapshot.allowAttachments,
    aiEnabled: snapshot.aiEnabled,
    offlineMessage: snapshot.offlineMessage,
    allowedOrigins: snapshot.allowedOrigins,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toPublicWidgetConfigurationDto(
  widget: WidgetConfiguration,
): PublicWidgetConfigurationDto {
  const snapshot = widget.toSnapshot();
  return {
    organizationId: snapshot.organizationId,
    publicKey: snapshot.publicKey,
    enabled: snapshot.enabled,
    title: snapshot.title,
    greeting: snapshot.greeting,
    primaryColor: snapshot.primaryColor,
    position: snapshot.position,
    launcherText: snapshot.launcherText,
    collectEmail: snapshot.collectEmail,
    allowAnonymous: snapshot.allowAnonymous,
    allowAttachments: snapshot.allowAttachments,
    aiEnabled: snapshot.aiEnabled,
    offlineMessage: snapshot.offlineMessage,
  };
}

export function toWidgetSessionDto(session: WidgetSession): WidgetSessionDto {
  const snapshot = session.toSnapshot();
  return {
    id: snapshot.id,
    organizationId: snapshot.organizationId,
    visitorId: snapshot.visitorId,
    kind: snapshot.kind,
    email: snapshot.email ?? null,
    name: snapshot.name ?? null,
    customerId: snapshot.customerId ?? null,
    expiresAt: snapshot.expiresAt.toISOString(),
    createdAt: snapshot.createdAt.toISOString(),
  };
}
