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
};

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
}
