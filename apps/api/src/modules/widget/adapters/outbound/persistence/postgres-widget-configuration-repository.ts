import type { Prisma, PrismaClient } from '@prisma/client';
import type { WidgetConfigurationRepository } from '../../../application/ports/widget-configuration-repository.js';
import { WidgetConfiguration, type WidgetConfigurationSnapshot } from '../../../domain/widget-configuration.js';
import { parseWidgetPosition } from '../../../domain/widget-appearance.js';
import { createWidgetConfigurationId } from '../../../domain/widget-configuration-id.js';

type WidgetRecord = {
  id: string;
  organizationId: string;
  publicKey: string;
  enabled: boolean;
  title: string;
  greeting: string;
  primaryColor: string;
  position: string;
  launcherText: string;
  collectEmail: boolean;
  allowAnonymous: boolean;
  allowAttachments: boolean;
  aiEnabled: boolean;
  offlineMessage: string;
  allowedOrigins: string[];
  createdAt: Date;
  updatedAt: Date;
};

export class PostgresWidgetConfigurationRepository implements WidgetConfigurationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByTenant(tenantId: string): Promise<WidgetConfiguration | null> {
    const record = await this.prisma.widgetConfiguration.findUnique({
      where: { organizationId: tenantId },
    });
    return record ? toWidget(record) : null;
  }

  async findByPublicKey(publicKey: string): Promise<WidgetConfiguration | null> {
    const record = await this.prisma.widgetConfiguration.findUnique({
      where: { publicKey },
    });
    return record ? toWidget(record) : null;
  }

  async findById(id: string): Promise<WidgetConfiguration | null> {
    const record = await this.prisma.widgetConfiguration.findUnique({
      where: { id },
    });
    return record ? toWidget(record) : null;
  }

  async save(widget: WidgetConfiguration): Promise<void> {
    const snapshot = widget.toSnapshot();
    const data = toRecord(snapshot);
    await this.prisma.widgetConfiguration.upsert({
      where: { id: snapshot.id },
      create: data,
      update: {
        publicKey: data.publicKey,
        enabled: data.enabled,
        title: data.title,
        greeting: data.greeting,
        primaryColor: data.primaryColor,
        position: data.position,
        launcherText: data.launcherText,
        collectEmail: data.collectEmail,
        allowAnonymous: data.allowAnonymous,
        allowAttachments: data.allowAttachments,
        aiEnabled: data.aiEnabled,
        offlineMessage: data.offlineMessage,
        allowedOrigins: data.allowedOrigins,
        updatedAt: data.updatedAt,
      },
    });
  }
}

function toWidget(record: WidgetRecord): WidgetConfiguration {
  const snapshot: WidgetConfigurationSnapshot = {
    id: createWidgetConfigurationId(record.id),
    organizationId: record.organizationId,
    publicKey: record.publicKey,
    enabled: record.enabled,
    title: record.title,
    greeting: record.greeting,
    primaryColor: record.primaryColor,
    position: parseWidgetPosition(record.position),
    launcherText: record.launcherText,
    collectEmail: record.collectEmail,
    allowAnonymous: record.allowAnonymous,
    allowAttachments: record.allowAttachments,
    aiEnabled: record.aiEnabled,
    offlineMessage: record.offlineMessage,
    allowedOrigins: record.allowedOrigins,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return WidgetConfiguration.reconstitute(snapshot);
}

function toRecord(
  snapshot: WidgetConfigurationSnapshot,
): Prisma.WidgetConfigurationUncheckedCreateInput {
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
    allowedOrigins: [...snapshot.allowedOrigins],
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
