import type {
  AgentSettingsDto,
  BusinessProfileDto,
  DeleteIndexedKnowledgeDocumentRequest,
  DeleteIndexedKnowledgeDocumentResponse,
  GenerateBusinessProfileRequest,
  GenerateInitialAgentSettingsRequest,
  GenerateSupportReplyRequest,
  GenerateSupportTonePresetsRequest,
  IngestKnowledgeDocumentRequest,
  IngestKnowledgeDocumentResponse,
  OnboardingSetupDraftDto,
  OrchestrateSupportTurnRequest,
  OrchestrateSupportTurnResponse,
  DetectIntentRequest,
  DetectIntentResponse,
  ApplyToolResultsRequest,
  ApplyToolResultsResponse,
  ProposeToolCallsRequest,
  ProposeToolCallsResponse,
  RagPlaygroundRequest,
  RagPlaygroundResponse,
  RunOnboardingSetupRequest,
  SupportReplyStreamEvent,
  SupportToneId,
  SupportTonePresetDto,
} from '@ai-customer-support/contracts';

/**
 * TypeScript integration boundary to the Python AI service.
 * Business modules call this port. They never import LLM, embedding, or vector SDKs.
 */
export type AICallContext = {
  readonly tenantId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId?: string;
  readonly spanId?: string;
};

export type AICallTelemetry = {
  readonly operation: string;
  readonly path: string;
  readonly tenantId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId?: string;
  readonly parentSpanId?: string;
  readonly latencyMs: number;
  readonly statusCode: number;
  readonly ok: boolean;
  readonly model?: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly evaluationVerdict?: 'passed' | 'degraded' | 'failed';
  readonly evaluationScore?: number;
  readonly evaluationReason?: string;
  readonly inputGuardrail?: string;
  readonly outputGuardrail?: string;
  readonly citationCount?: number;
  readonly errorCode?: string;
};

export interface AICallTelemetryPort {
  record(telemetry: AICallTelemetry): Promise<void>;
}

export type SupportToneGenerationResult = {
  readonly items: readonly SupportTonePresetDto[];
  readonly selectedToneId: SupportToneId;
};

export interface AIServicePort {
  isReady(): Promise<boolean>;
  generateBusinessProfile(
    context: AICallContext,
    input: GenerateBusinessProfileRequest,
  ): Promise<BusinessProfileDto>;
  generateSupportTonePresets(
    context: AICallContext,
    input: GenerateSupportTonePresetsRequest,
  ): Promise<SupportToneGenerationResult>;
  generateInitialAgentSettings(
    context: AICallContext,
    input: GenerateInitialAgentSettingsRequest,
  ): Promise<AgentSettingsDto>;
  runOnboardingSetup(
    context: AICallContext,
    input: RunOnboardingSetupRequest,
  ): Promise<OnboardingSetupDraftDto>;
  streamSupportReply(
    context: AICallContext,
    input: GenerateSupportReplyRequest,
  ): AsyncIterable<SupportReplyStreamEvent>;
  ingestKnowledgeDocument(
    context: AICallContext,
    input: IngestKnowledgeDocumentRequest,
  ): Promise<IngestKnowledgeDocumentResponse>;
  deleteIndexedKnowledgeDocument(
    context: AICallContext,
    input: DeleteIndexedKnowledgeDocumentRequest,
  ): Promise<DeleteIndexedKnowledgeDocumentResponse>;
  detectIntent(context: AICallContext, input: DetectIntentRequest): Promise<DetectIntentResponse>;
  orchestrateSupportTurn(
    context: AICallContext,
    input: OrchestrateSupportTurnRequest,
  ): Promise<OrchestrateSupportTurnResponse>;
  proposeToolCalls(context: AICallContext, input: ProposeToolCallsRequest): Promise<ProposeToolCallsResponse>;
  applyToolResults(context: AICallContext, input: ApplyToolResultsRequest): Promise<ApplyToolResultsResponse>;
  runRagPlayground(context: AICallContext, input: RagPlaygroundRequest): Promise<RagPlaygroundResponse>;
}
