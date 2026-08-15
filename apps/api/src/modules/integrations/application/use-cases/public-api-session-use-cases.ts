import {
  PUBLIC_API_SCHEMA_VERSION,
  type PublicApiSessionResponse,
  type PublicApiVersionResponse,
} from '@ai-customer-support/contracts';
import { PUBLIC_API_PREFIX, PUBLIC_API_VERSION } from '../../domain/api-version.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import type { TenantAccessPort } from '../ports.js';

export class GetPublicApiVersionUseCase {
  execute(): PublicApiVersionResponse {
    return {
      apiVersion: PUBLIC_API_VERSION,
      schemaVersion: PUBLIC_API_SCHEMA_VERSION,
      documentationUrl: `${PUBLIC_API_PREFIX}/docs`,
      openApiUrl: `${PUBLIC_API_PREFIX}/openapi.json`,
    };
  }
}

export class GetPublicApiSessionUseCase {
  constructor(private readonly tenantAccess: TenantAccessPort) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly authKind: PublicApiSessionResponse['auth']['kind'];
    readonly scopes?: readonly string[];
  }): Promise<PublicApiSessionResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertPermission(actor.permissions, Permissions.ORGANIZATION_READ);
    return {
      apiVersion: PUBLIC_API_VERSION,
      organizationId: actor.tenantId,
      auth: {
        kind: input.authKind,
        scopes: input.scopes ?? actor.permissions,
      },
    };
  }
}
