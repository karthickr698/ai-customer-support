import type { NotificationPreferenceListResponse } from '@ai-customer-support/contracts';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { InvalidNotificationError, TooManyNotificationRecordsError } from '../../domain/errors.js';
import {
  MAX_PREFERENCES_PER_SUBJECT,
  NotificationPolicy,
} from '../../domain/notification-policy.js';
import { NotificationPreference } from '../../domain/notification-preference.js';
import { parseChannel, parsePreferenceSubjectType } from '../../domain/values.js';
import { toPreferenceDto } from '../dtos.js';
import type { ClockPort, NotificationPreferenceRepository, TenantAccessPort } from '../ports.js';

export class ListNotificationPreferencesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly preferences: NotificationPreferenceRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly subjectType?: string;
    readonly subjectKey?: string;
  }): Promise<NotificationPreferenceListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    const subject = resolveSubject(actor, input.subjectType, input.subjectKey);
    if (subject.subjectKey !== actor.actorId.toLowerCase() || subject.subjectType !== 'user') {
      NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_MANAGE);
    } else {
      NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    }
    const items = await this.preferences.listBySubject({
      tenantId: actor.tenantId,
      subjectType: subject.subjectType,
      subjectKey: subject.subjectKey,
    });
    return { items: items.filter((item) => item.belongsTo(actor.tenantId)).map(toPreferenceDto) };
  }
}

export class UpsertNotificationPreferencesUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly preferences: NotificationPreferenceRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly items: readonly {
      readonly eventType: string;
      readonly channel: string;
      readonly enabled: boolean;
    }[];
    readonly subjectType?: string;
    readonly subjectKey?: string;
  }): Promise<NotificationPreferenceListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    const subject = resolveSubject(actor, input.subjectType, input.subjectKey);
    if (subject.subjectKey !== actor.actorId.toLowerCase() || subject.subjectType !== 'user') {
      NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_MANAGE);
    } else {
      NotificationPolicy.assertPermission(actor.permissions, Permissions.NOTIFICATION_READ);
    }
    if (input.items.length === 0 || input.items.length > MAX_PREFERENCES_PER_SUBJECT) {
      throw new InvalidNotificationError(
        `Provide between 1 and ${MAX_PREFERENCES_PER_SUBJECT} preference items`,
      );
    }
    const now = this.clock.now();
    const saved: NotificationPreference[] = [];
    for (const item of input.items) {
      const existing = await this.preferences.findBySubjectEventChannel({
        tenantId: actor.tenantId,
        subjectType: subject.subjectType,
        subjectKey: subject.subjectKey,
        eventType: item.eventType.trim(),
        channel: parseChannel(item.channel),
      });
      if (existing && existing.belongsTo(actor.tenantId)) {
        existing.setEnabled(item.enabled, now);
        await this.preferences.save(existing);
        saved.push(existing);
        continue;
      }
      const count = await this.preferences.countBySubject({
        tenantId: actor.tenantId,
        subjectType: subject.subjectType,
        subjectKey: subject.subjectKey,
      });
      if (count >= MAX_PREFERENCES_PER_SUBJECT) {
        throw new TooManyNotificationRecordsError('notification preferences');
      }
      const preference = NotificationPreference.create({
        organizationId: actor.tenantId,
        subjectType: subject.subjectType,
        subjectKey: subject.subjectKey,
        eventType: item.eventType,
        channel: item.channel,
        enabled: item.enabled,
        now,
      });
      await this.preferences.save(preference);
      saved.push(preference);
    }
    return { items: saved.map(toPreferenceDto) };
  }
}

function resolveSubject(
  actor: { readonly actorId: string; readonly permissions: readonly string[] },
  subjectType?: string,
  subjectKey?: string,
): { subjectType: 'user' | 'email' | 'phone'; subjectKey: string } {
  if (!subjectType && !subjectKey) {
    return { subjectType: 'user', subjectKey: actor.actorId.toLowerCase() };
  }
  if (!subjectType || !subjectKey) {
    throw new InvalidNotificationError('subjectType and subjectKey must be provided together');
  }
  return {
    subjectType: parsePreferenceSubjectType(subjectType),
    subjectKey: subjectKey.trim().toLowerCase(),
  };
}
