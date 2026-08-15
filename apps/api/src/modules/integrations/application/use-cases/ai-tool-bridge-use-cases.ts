import type {
  ApplyToolResultsRequest,
  ApplyToolResultsResponse,
  ProposeToolCallsRequest,
  ProposeToolCallsResponse,
} from '@ai-customer-support/contracts';
import type { AICallContext, AIServicePort } from '../../../ai/application/ports/ai-service-port.js';
import { Permissions } from '../../../organizations/domain/permissions.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { validateToolArguments } from '../../domain/tool-catalog.js';
import type { TenantAccessPort } from '../ports.js';

export class ProposeToolCallsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly aiService: AIServicePort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly body: ProposeToolCallsRequest;
  }): Promise<ProposeToolCallsResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_WRITE);

    const proposed = await this.aiService.proposeToolCalls(aiContext(actor.tenantId, input), input.body);
    for (const call of proposed.calls) {
      validateToolArguments(call.name, call.arguments);
    }
    return proposed;
  }
}

export class ApplyToolResultsUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly aiService: AIServicePort,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly body: ApplyToolResultsRequest;
  }): Promise<ApplyToolResultsResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    IntegrationPolicy.assertPermission(actor.permissions, Permissions.CONVERSATION_WRITE);
    return this.aiService.applyToolResults(aiContext(actor.tenantId, input), input.body);
  }
}

function aiContext(
  tenantId: string,
  input: { requestId: string; correlationId: string },
): AICallContext {
  return {
    tenantId,
    requestId: input.requestId,
    correlationId: input.correlationId,
  };
}
