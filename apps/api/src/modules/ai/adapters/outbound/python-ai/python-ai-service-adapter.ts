import {
  isAgentSettingsDto,
  isAIServiceHealthResponse,
  isBusinessProfileDto,
  isDeleteIndexedKnowledgeDocumentResponse,
  isGenerateSupportReplyResponse,
  isIngestKnowledgeDocumentResponse,
  isOnboardingSetupDraftDto,
  isSupportReplyStreamEvent,
  isSupportToneId,
  isSupportTonePresetList,
  type AgentSettingsDto,
  type BusinessProfileDto,
  type DeleteIndexedKnowledgeDocumentRequest,
  type DeleteIndexedKnowledgeDocumentResponse,
  type GenerateBusinessProfileRequest,
  type GenerateInitialAgentSettingsRequest,
  type GenerateSupportReplyRequest,
  type GenerateSupportTonePresetsRequest,
  type IngestKnowledgeDocumentRequest,
  type IngestKnowledgeDocumentResponse,
  type OnboardingSetupDraftDto,
  type RunOnboardingSetupRequest,
  type SupportReplyStreamEvent,
} from '@ai-customer-support/contracts';
import type { Logger, RequestContext } from '@ai-customer-support/shared';
import {
  AIProviderError,
  AIServiceUnavailableError,
  InvalidAIPayloadError,
} from '../../../application/errors.js';
import type {
  AICallContext,
  AIServicePort,
  SupportToneGenerationResult,
} from '../../../application/ports/ai-service-port.js';

const HEALTH_TIMEOUT_MS = 3_000;
const GENERATE_TIMEOUT_MS = 45_000;
const SETUP_TIMEOUT_MS = 90_000;
const INGEST_TIMEOUT_MS = 90_000;

export function pythonAiRequestHeaders(
  context: Pick<RequestContext, 'requestId' | 'correlationId' | 'tenantId'>,
): Record<string, string> {
  const headers: Record<string, string> = {
    'x-request-id': context.requestId,
    'x-correlation-id': context.correlationId,
  };

  if (context.tenantId) {
    headers['x-tenant-id'] = context.tenantId;
  }

  return headers;
}

export class PythonAIServiceAdapter implements AIServicePort {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async isReady(): Promise<boolean> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });

      if (!response.ok) {
        return false;
      }

      const body: unknown = await response.json();
      return isAIServiceHealthResponse(body);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Python AI health check failed';
      this.logger.warn('Python AI service is not reachable', { message });
      return false;
    }
  }

  async generateBusinessProfile(
    context: AICallContext,
    input: GenerateBusinessProfileRequest,
  ): Promise<BusinessProfileDto> {
    const body = await this.postJson('/v1/onboarding/business-profile', context, input, GENERATE_TIMEOUT_MS);
    if (!isRecord(body) || !isBusinessProfileDto(body.businessProfile)) {
      throw new InvalidAIPayloadError('Business profile payload failed validation');
    }
    return body.businessProfile;
  }

  async generateSupportTonePresets(
    context: AICallContext,
    input: GenerateSupportTonePresetsRequest,
  ): Promise<SupportToneGenerationResult> {
    const body = await this.postJson('/v1/onboarding/tone-presets', context, input, GENERATE_TIMEOUT_MS);
    if (!isRecord(body) || !isSupportTonePresetList(body.items) || !isSupportToneId(body.selectedToneId)) {
      throw new InvalidAIPayloadError('Support tone payload failed validation');
    }
    return { items: body.items, selectedToneId: body.selectedToneId };
  }

  async generateInitialAgentSettings(
    context: AICallContext,
    input: GenerateInitialAgentSettingsRequest,
  ): Promise<AgentSettingsDto> {
    const body = await this.postJson('/v1/onboarding/agent-settings', context, input, GENERATE_TIMEOUT_MS);
    if (!isRecord(body) || !isAgentSettingsDto(body.agentSettings)) {
      throw new InvalidAIPayloadError('Agent settings payload failed validation');
    }
    return body.agentSettings;
  }

  async runOnboardingSetup(
    context: AICallContext,
    input: RunOnboardingSetupRequest,
  ): Promise<OnboardingSetupDraftDto> {
    const body = await this.postJson('/v1/onboarding/setup', context, input, SETUP_TIMEOUT_MS);
    if (!isOnboardingSetupDraftDto(body)) {
      throw new InvalidAIPayloadError('Onboarding setup payload failed validation');
    }
    return body;
  }

  async *streamSupportReply(
    context: AICallContext,
    input: GenerateSupportReplyRequest,
  ): AsyncIterable<SupportReplyStreamEvent> {
    const headers = {
      ...pythonAiRequestHeaders({
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
      }),
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    };

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/support/reply/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Python AI stream failed';
      this.logger.warn('Python AI support stream failed', {
        message,
        tenantId: context.tenantId,
      });
      throw new AIServiceUnavailableError();
    }

    if (!response.ok || !response.body) {
      this.logger.warn('Python AI support stream returned an error', {
        tenantId: context.tenantId,
        status: response.status,
      });
      throw response.status >= 500 ? new AIProviderError() : new InvalidAIPayloadError();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const event = parseSseEvent(part);
        if (event) {
          yield event;
        }
      }
    }

    const trailing = parseSseEvent(buffer);
    if (trailing) {
      yield trailing;
    }
  }

  async ingestKnowledgeDocument(
    context: AICallContext,
    input: IngestKnowledgeDocumentRequest,
  ): Promise<IngestKnowledgeDocumentResponse> {
    const body = await this.postJson('/v1/knowledge/ingest', context, input, INGEST_TIMEOUT_MS);
    if (!isIngestKnowledgeDocumentResponse(body)) {
      throw new InvalidAIPayloadError('Knowledge ingestion payload failed validation');
    }
    return body;
  }

  async deleteIndexedKnowledgeDocument(
    context: AICallContext,
    input: DeleteIndexedKnowledgeDocumentRequest,
  ): Promise<DeleteIndexedKnowledgeDocumentResponse> {
    const body = await this.postJson('/v1/knowledge/index/delete', context, input, GENERATE_TIMEOUT_MS);
    if (!isDeleteIndexedKnowledgeDocumentResponse(body)) {
      throw new InvalidAIPayloadError('Knowledge index delete payload failed validation');
    }
    return body;
  }

  private async postJson(
    path: string,
    context: AICallContext,
    payload: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    const headers = {
      ...pythonAiRequestHeaders({
        requestId: context.requestId,
        correlationId: context.correlationId,
        tenantId: context.tenantId,
      }),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Python AI request failed';
      this.logger.warn('Python AI onboarding call failed', {
        message,
        tenantId: context.tenantId,
        path,
      });
      throw new AIServiceUnavailableError();
    }

    if (response.status === 429) {
      throw new AIProviderError('The AI service rate limit was exceeded');
    }

    if (!response.ok) {
      this.logger.warn('Python AI onboarding call returned an error', {
        tenantId: context.tenantId,
        path,
        status: response.status,
      });
      if (response.status >= 500) {
        throw new AIProviderError();
      }
      throw new InvalidAIPayloadError('The AI service rejected the onboarding request');
    }

    try {
      return await response.json();
    } catch {
      throw new InvalidAIPayloadError('The AI service returned a malformed response');
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSseEvent(chunk: string): SupportReplyStreamEvent | undefined {
  const dataLine = chunk
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('data:'));
  if (!dataLine) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(dataLine.slice(5).trim());
    if (isSupportReplyStreamEvent(parsed)) {
      return parsed;
    }

    if (isRecord(parsed) && parsed.type === 'done' && isGenerateSupportReplyResponse(parsed.reply)) {
      return { type: 'done', reply: parsed.reply };
    }
  } catch {
    return undefined;
  }

  return undefined;
}
