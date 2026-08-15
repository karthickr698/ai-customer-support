import type { EventBus } from '@ai-customer-support/shared';
import type {
  IntegrationCredentialListResponse,
  IntegrationCredentialResponse,
} from '@ai-customer-support/contracts';
import { IntegrationCredentialNotFoundError } from '../../domain/errors.js';
import {
  IntegrationCredentialRevokedEvent,
  IntegrationCredentialUpsertedEvent,
} from '../../domain/events.js';
import { createIntegrationCredentialId } from '../../domain/ids.js';
import { assertSecret, IntegrationCredential } from '../../domain/integration-credential.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { parseToolName } from '../../domain/tool-catalog.js';
import { toCredentialDto, type RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  IntegrationCredentialRepository,
  SecretCipherPort,
  TenantAccessPort,
} from '../ports.js';

export class UpsertIntegrationCredentialUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly cipher: SecretCipherPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly toolName: string;
    readonly name: string;
    readonly kind: string;
    readonly secret: string;
    readonly baseUrl: string;
    readonly headerName?: string;
    readonly provider?: string;
    readonly security: RequestSecurityContext;
  }): Promise<IntegrationCredentialResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);

    const toolName = parseToolName(input.toolName);
    const plaintext = assertSecret(input.secret);
    const encrypted = this.cipher.encrypt(plaintext);
    const now = this.clock.now();
    const existing = await this.credentials.findActiveByTool(actor.tenantId, toolName);

    const credential = existing
      ? existing.replaceSecret({
          secret: encrypted,
          plaintextSecret: plaintext,
          name: input.name,
          kind: input.kind,
          baseUrl: input.baseUrl,
          headerName: input.headerName,
          provider: input.provider,
          now,
        })
      : IntegrationCredential.create({
          organizationId: actor.tenantId,
          toolName,
          name: input.name,
          kind: input.kind,
          secret: encrypted,
          plaintextSecret: plaintext,
          baseUrl: input.baseUrl,
          headerName: input.headerName,
          provider: input.provider,
          createdByUserId: actor.actorId,
          now,
        });

    await this.credentials.save(credential);
    await this.eventBus.publish(
      new IntegrationCredentialUpsertedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        credential.id,
        credential.toolName,
        input.security.correlationId,
      ),
    );

    return { credential: toCredentialDto(credential) };
  }
}

export class ListIntegrationCredentialsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
  }): Promise<IntegrationCredentialListResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);
    const items = await this.credentials.listActiveByTenant(actor.tenantId);
    return { items: items.map(toCredentialDto) };
  }
}

export class RevokeIntegrationCredentialUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly credentialId: string;
    readonly security: RequestSecurityContext;
  }): Promise<void> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertCanManage(actor.permissions);

    const credential = await this.credentials.findById(
      actor.tenantId,
      createIntegrationCredentialId(input.credentialId),
    );
    if (!credential || !credential.isActive) {
      throw new IntegrationCredentialNotFoundError();
    }

    const now = this.clock.now();
    const revoked = credential.revoke(now);
    await this.credentials.save(revoked);
    await this.eventBus.publish(
      new IntegrationCredentialRevokedEvent(
        crypto.randomUUID(),
        now,
        actor.tenantId,
        revoked.id,
        revoked.toolName,
        input.security.correlationId,
      ),
    );
  }
}
