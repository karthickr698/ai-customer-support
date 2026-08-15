import {
  isAgentSettingsDto,
  isAIServiceHealthResponse,
  isBusinessProfileDto,
  isDeleteIndexedKnowledgeDocumentResponse,
  isDetectIntentResponse,
  isGenerateSupportReplyResponse,
  isIngestKnowledgeDocumentResponse,
  isOnboardingSetupDraftDto,
  isOrchestrateSupportTurnResponse,
  isProposeToolCallsResponse,
  isApplyToolResultsResponse,
  isSupportReplyStreamEvent,
  isSupportToneId,
  isSupportTonePresetList,
  type AgentSettingsDto,
  type BusinessProfileDto,
  type DeleteIndexedKnowledgeDocumentRequest,
  type DeleteIndexedKnowledgeDocumentResponse,
  type DetectIntentRequest,
  type DetectIntentResponse,
  type GenerateBusinessProfileRequest,
  type GenerateInitialAgentSettingsRequest,
  type GenerateSupportReplyRequest,
  type GenerateSupportTonePresetsRequest,
  type IngestKnowledgeDocumentRequest,
  type IngestKnowledgeDocumentResponse,
  type OnboardingSetupDraftDto,
  type OrchestrateSupportTurnRequest,
  type OrchestrateSupportTurnResponse,
  type ProposeToolCallsRequest,
  type ProposeToolCallsResponse,
  type ApplyToolResultsRequest,
  type ApplyToolResultsResponse,
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
  AICallTelemetryPort,
  AIServicePort,
  SupportToneGenerationResult,
} from '../../../application/ports/ai-service-port.js';

const HEALTH_TIMEOUT_MS = 3_000;
const GENERATE_TIMEOUT_MS = 45_000;
const SETUP_TIMEOUT_MS = 90_000;
const INGEST_TIMEOUT_MS = 90_000;

export function pythonAiRequestHeaders(
  context: Pick<RequestContext, 'requestId' | 'correlationId' | 'tenantId' | 'traceId' | 'spanId'>,
): Record<string, string> {
  const headers: Record<string, string> = {
    'x-request-id': context.requestId,
    'x-correlation-id': context.correlationId,
  };

  if (context.tenantId) {
    headers['x-tenant-id'] = context.tenantId;
  }
  if (context.traceId) {
    headers['x-trace-id'] = context.traceId;
  }
  if (context.spanId) {
    headers['x-parent-span-id'] = context.spanId;
  }

  return headers;
}

export class PythonAIServiceAdapter implements AIServicePort {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly telemetry?: AICallTelemetryPort,
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
        traceId: context.traceId,
        spanId: context.spanId,
      }),
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    };

    const started = Date.now();
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
      await this.recordTelemetry(context, '/v1/support/reply/stream', Date.now() - started, 0, false, undefined, 'AI_SERVICE_UNAVAILABLE');
      throw new AIServiceUnavailableError();
    }

    if (!response.ok || !response.body) {
      this.logger.warn('Python AI support stream returned an error', {
        tenantId: context.tenantId,
        status: response.status,
      });
      await this.recordTelemetry(context, '/v1/support/reply/stream', Date.now() - started, response.status, false, response.headers);
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
    await this.recordTelemetry(
      context,
      '/v1/support/reply/stream',
      Date.now() - started,
      response.status,
      true,
      response.headers,
    );
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

  async detectIntent(context: AICallContext, input: DetectIntentRequest): Promise<DetectIntentResponse> {
    const body = await this.postJson('/v1/orchestration/intent', context, input, GENERATE_TIMEOUT_MS);
    if (!isDetectIntentResponse(body)) {
      throw new InvalidAIPayloadError('Intent detection payload failed validation');
    }
    return body;
  }

  async orchestrateSupportTurn(
    context: AICallContext,
    input: OrchestrateSupportTurnRequest,
  ): Promise<OrchestrateSupportTurnResponse> {
    const body = await this.postJson('/v1/orchestration/run', context, input, GENERATE_TIMEOUT_MS);
    if (!isOrchestrateSupportTurnResponse(body)) {
      throw new InvalidAIPayloadError('Orchestration payload failed validation');
    }
    return body;
  }

  async proposeToolCalls(
    context: AICallContext,
    input: ProposeToolCallsRequest,
  ): Promise<ProposeToolCallsResponse> {
    const body = await this.postJson('/v1/tools/propose', context, input, GENERATE_TIMEOUT_MS);
    if (!isProposeToolCallsResponse(body)) {
      throw new InvalidAIPayloadError('Tool proposal payload failed validation');
    }
    return body;
  }

  async applyToolResults(
    context: AICallContext,
    input: ApplyToolResultsRequest,
  ): Promise<ApplyToolResultsResponse> {
    const body = await this.postJson('/v1/tools/apply-results', context, input, GENERATE_TIMEOUT_MS);
    if (!isApplyToolResultsResponse(body)) {
      throw new InvalidAIPayloadError('Tool result payload failed validation');
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
        traceId: context.traceId,
        spanId: context.spanId,
      }),
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    const started = Date.now();
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
      await this.recordTelemetry(
        context,
        path,
        Date.now() - started,
        0,
        false,
        undefined,
        'AI_SERVICE_UNAVAILABLE',
      );
      throw new AIServiceUnavailableError();
    }

    if (response.status === 429) {
      await this.recordTelemetry(context, path, Date.now() - started, 429, false, response.headers, 'AI_PROVIDER_ERROR');
      throw new AIProviderError('The AI service rate limit was exceeded');
    }

    if (!response.ok) {
      this.logger.warn('Python AI onboarding call returned an error', {
        tenantId: context.tenantId,
        path,
        status: response.status,
      });
      await this.recordTelemetry(
        context,
        path,
        Date.now() - started,
        response.status,
        false,
        response.headers,
        response.status >= 500 ? 'AI_PROVIDER_ERROR' : 'INVALID_AI_PAYLOAD',
      );
      if (response.status >= 500) {
        throw new AIProviderError();
      }
      throw new InvalidAIPayloadError('The AI service rejected the onboarding request');
    }

    try {
      const body: unknown = await response.json();
      await this.recordTelemetry(context, path, Date.now() - started, response.status, true, response.headers);
      return body;
    } catch {
      await this.recordTelemetry(
        context,
        path,
        Date.now() - started,
        response.status,
        false,
        response.headers,
        'INVALID_AI_PAYLOAD',
      );
      throw new InvalidAIPayloadError('The AI service returned a malformed response');
    }
  }

  private async recordTelemetry(
    context: AICallContext,
    path: string,
    latencyMs: number,
    statusCode: number,
    ok: boolean,
    headers?: Headers,
    errorCode?: string,
  ): Promise<void> {
    if (!this.telemetry) {
      return;
    }
    const verdict = header(headers, 'x-ai-eval-verdict');
    await this.telemetry.record({
      operation: operationFromPath(path),
      path,
      tenantId: context.tenantId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      traceId: context.traceId ?? header(headers, 'x-trace-id') ?? context.correlationId,
      parentSpanId: context.spanId,
      latencyMs,
      statusCode,
      ok,
      model: header(headers, 'x-ai-model'),
      promptTokens: headerInt(headers, 'x-ai-prompt-tokens'),
      completionTokens: headerInt(headers, 'x-ai-completion-tokens'),
      evaluationVerdict: verdict === 'passed' || verdict === 'degraded' || verdict === 'failed' ? verdict : undefined,
      evaluationScore: headerFloat(headers, 'x-ai-eval-score'),
      evaluationReason: header(headers, 'x-ai-eval-reason'),
      inputGuardrail: header(headers, 'x-ai-guardrail-in'),
      outputGuardrail: header(headers, 'x-ai-guardrail-out'),
      citationCount: headerInt(headers, 'x-ai-citations'),
      errorCode,
    });
  }
}

function header(headers: Headers | undefined, name: string): string | undefined {
  const value = headers?.get(name);
  return value && value.length > 0 ? value : undefined;
}

function headerInt(headers: Headers | undefined, name: string): number | undefined {
  const value = header(headers, name);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function headerFloat(headers: Headers | undefined, name: string): number | undefined {
  const value = header(headers, name);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function operationFromPath(path: string): string {
  switch (path) {
    case '/v1/onboarding/business-profile':
      return 'generate_business_profile';
    case '/v1/onboarding/tone-presets':
      return 'generate_support_tone_presets';
    case '/v1/onboarding/agent-settings':
      return 'generate_initial_agent_settings';
    case '/v1/onboarding/setup':
      return 'run_onboarding_setup';
    case '/v1/support/reply/stream':
      return 'generate_support_reply';
    case '/v1/knowledge/ingest':
      return 'ingest_knowledge_document';
    case '/v1/knowledge/index/delete':
      return 'delete_indexed_document';
    case '/v1/orchestration/intent':
      return 'detect_intent';
    case '/v1/orchestration/run':
      return 'orchestrate_support_turn';
    case '/v1/tools/propose':
      return 'propose_tool_calls';
    case '/v1/tools/apply-results':
      return 'apply_tool_results';
    default:
      return path.replace(/^\//, '').replace(/\//g, '_');
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
