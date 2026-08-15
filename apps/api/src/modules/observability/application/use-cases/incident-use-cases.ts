import type { EventBus } from '@ai-customer-support/shared';
import type { ObservabilityIncidentResponse } from '@ai-customer-support/contracts';
import { ObservabilityIncidentAcknowledgedEvent, ObservabilityIncidentResolvedEvent } from '../../domain/events.js';
import { ObservabilityIncidentNotFoundError } from '../../domain/errors.js';
import { createObservabilityIncidentId } from '../../domain/ids.js';
import { requireUuid } from '../../domain/values.js';
import { toIncidentDto, type RequestSecurityContext } from '../dtos.js';
import type { ClockPort, ObservabilityIncidentRepository, PlatformAccessPort, TenantAccessPort } from '../ports.js';
import { loadObservabilityActor, type ObservabilityQueryScope } from './query-observability-use-cases.js';

export class AcknowledgeObservabilityIncidentUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly incidents: ObservabilityIncidentRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    input: ObservabilityQueryScope & {
      readonly incidentId: string;
      readonly security?: RequestSecurityContext;
    },
  ): Promise<ObservabilityIncidentResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'manage');
    const incident = await this.incidents.findById(
      createObservabilityIncidentId(requireUuid(input.incidentId, 'incidentId')),
      actor.organizationId ?? input.organizationId,
    );
    if (!incident) {
      throw new ObservabilityIncidentNotFoundError();
    }
    const now = this.clock.now();
    incident.acknowledge(actor.actorId, now);
    await this.incidents.save(incident);
    await this.eventBus.publish(
      new ObservabilityIncidentAcknowledgedEvent(
        crypto.randomUUID(),
        now,
        incident.id,
        incident.toSnapshot().organizationId,
        input.security?.correlationId,
      ),
    );
    return { incident: toIncidentDto(incident) };
  }
}

export class ResolveObservabilityIncidentUseCase {
  constructor(
    private readonly platformAccess: PlatformAccessPort,
    private readonly tenantAccess: TenantAccessPort,
    private readonly incidents: ObservabilityIncidentRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(
    input: ObservabilityQueryScope & {
      readonly incidentId: string;
      readonly security?: RequestSecurityContext;
    },
  ): Promise<ObservabilityIncidentResponse> {
    const actor = await loadObservabilityActor(input, this.platformAccess, this.tenantAccess, 'manage');
    const incident = await this.incidents.findById(
      createObservabilityIncidentId(requireUuid(input.incidentId, 'incidentId')),
      actor.organizationId ?? input.organizationId,
    );
    if (!incident) {
      throw new ObservabilityIncidentNotFoundError();
    }
    const now = this.clock.now();
    incident.resolve(actor.actorId, now);
    await this.incidents.save(incident);
    await this.eventBus.publish(
      new ObservabilityIncidentResolvedEvent(
        crypto.randomUUID(),
        now,
        incident.id,
        incident.toSnapshot().organizationId,
        input.security?.correlationId,
      ),
    );
    return { incident: toIncidentDto(incident) };
  }
}
