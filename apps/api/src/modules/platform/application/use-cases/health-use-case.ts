import type { PlatformHealthResponse } from '@ai-customer-support/contracts';
import { PlatformHealthReport } from '../../domain/health-report.js';
import { assertPlatformPermission, permissionsForPlatformRole, PlatformPermissions } from '../../domain/permissions.js';
import { toHealthResponse } from '../dtos.js';
import type { ClockPort, PlatformHealthProbePort } from '../ports.js';
import type { LoadPlatformActorService } from './operator-use-cases.js';

export class GetPlatformHealthUseCase {
  constructor(
    private readonly actors: LoadPlatformActorService,
    private readonly probe: PlatformHealthProbePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: { readonly actorId: string }): Promise<PlatformHealthResponse> {
    const actor = await this.actors.execute(input.actorId);
    assertPlatformPermission(permissionsForPlatformRole(actor.role), PlatformPermissions.HEALTH_READ);
    const checks = await this.probe.probe();
    return toHealthResponse(PlatformHealthReport.from(checks, this.clock.now()));
  }
}
