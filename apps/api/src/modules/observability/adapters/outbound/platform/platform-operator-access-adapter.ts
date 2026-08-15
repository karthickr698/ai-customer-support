import { permissionsForPlatformRole } from '../../../../platform/domain/permissions.js';
import type { LoadPlatformActorService } from '../../../../platform/application/use-cases/operator-use-cases.js';
import type { ObservabilityActor, PlatformAccessPort } from '../../../application/ports.js';

export class PlatformOperatorAccessAdapter implements PlatformAccessPort {
  constructor(private readonly actors: LoadPlatformActorService) {}

  async loadActor(actorId: string): Promise<ObservabilityActor> {
    const operator = await this.actors.execute(actorId);
    return {
      actorId: operator.userId,
      permissions: permissionsForPlatformRole(operator.role),
    };
  }
}
