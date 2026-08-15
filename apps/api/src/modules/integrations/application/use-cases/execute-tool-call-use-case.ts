import type { EventBus } from '@ai-customer-support/shared';
import type { ExecuteToolCallResponse, ToolName } from '@ai-customer-support/contracts';
import {
  ToolCredentialRequiredError,
  ToolExecutionError,
  ToolTimeoutError,
} from '../../domain/errors.js';
import { ToolCallExecutedEvent } from '../../domain/events.js';
import { IntegrationPolicy } from '../../domain/integration-policy.js';
import { HTTP_TOOL_PROVIDERS, validateToolArguments } from '../../domain/tool-catalog.js';
import { ToolInvocation } from '../../domain/tool-invocation.js';
import { joinSafeUrl } from '../../domain/outbound-url.js';
import { toInvocationDto, type RequestSecurityContext } from '../dtos.js';
import type {
  ClockPort,
  HttpToolInvokerPort,
  IntegrationCredentialRepository,
  OAuthConnectorRepository,
  OAuthTokenExchangePort,
  PlatformToolHandlerPort,
  SecretCipherPort,
  TenantAccessPort,
  ToolInvocationRepository,
} from '../ports.js';

const HTTP_PATHS: Record<Extract<ToolName, 'getOrderDetails' | 'checkRefundStatus'>, string> = {
  getOrderDetails: '/orders/lookup',
  checkRefundStatus: '/refunds/status',
};

export class ExecuteToolCallUseCase {
  constructor(
    private readonly tenantAccess: TenantAccessPort,
    private readonly invocations: ToolInvocationRepository,
    private readonly credentials: IntegrationCredentialRepository,
    private readonly connectors: OAuthConnectorRepository,
    private readonly cipher: SecretCipherPort,
    private readonly http: HttpToolInvokerPort,
    private readonly oauth: OAuthTokenExchangePort,
    private readonly platform: PlatformToolHandlerPort,
    private readonly clock: ClockPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly name: string;
    readonly arguments: unknown;
    readonly conversationId?: string;
    readonly actorType?: 'user' | 'ai';
    readonly security: RequestSecurityContext;
  }): Promise<ExecuteToolCallResponse> {
    const actor = await this.tenantAccess.loadActor(input.tenantId, input.actorId);
    const { definition, arguments: args } = validateToolArguments(input.name, input.arguments);
    IntegrationPolicy.assertCanExecute(actor.permissions, definition);

    const startedAt = this.clock.now();
    let invocation = ToolInvocation.start({
      organizationId: actor.tenantId,
      toolName: definition.name,
      argumentPayload: args,
      actorType: input.actorType ?? 'user',
      actorId: actor.actorId,
      conversationId: input.conversationId,
      ipAddress: input.security.ipAddress,
      userAgent: input.security.userAgent,
      requestId: input.security.requestId,
      correlationId: input.security.correlationId,
      now: startedAt,
    });
    await this.invocations.save(invocation);

    try {
      const executed =
        definition.executionKind === 'http'
          ? await this.executeHttp(actor.tenantId, asHttpToolName(definition.name), args, definition.retry)
          : {
              data: await this.platform.execute({
                tenantId: actor.tenantId,
                toolName: definition.name,
                arguments: args,
                actorId: actor.actorId,
              }),
              attemptCount: 1,
              credentialId: undefined,
              connectorId: undefined,
            };

      invocation = invocation
        .withExecutionRefs({
          credentialId: executed.credentialId,
          connectorId: executed.connectorId,
        })
        .complete({
          status: 'succeeded',
          result: executed.data,
          attemptCount: executed.attemptCount,
          now: this.clock.now(),
        });
    } catch (error: unknown) {
      const timedOut = error instanceof ToolTimeoutError;
      invocation = invocation.complete({
        status: timedOut ? 'timed_out' : 'failed',
        errorCode: timedOut ? 'TOOL_TIMEOUT' : 'TOOL_EXECUTION_FAILED',
        errorMessage: error instanceof Error ? error.message : 'The tool call failed',
        attemptCount: 1,
        now: this.clock.now(),
      });
      await this.invocations.save(invocation);
      await this.publish(invocation, input.security.correlationId);
      throw error;
    }

    await this.invocations.save(invocation);
    await this.publish(invocation, input.security.correlationId);
    return { invocation: toInvocationDto(invocation) };
  }

  private async executeHttp(
    tenantId: string,
    toolName: Extract<ToolName, 'getOrderDetails' | 'checkRefundStatus'>,
    args: Record<string, unknown>,
    retry: { timeoutMs: number; maxAttempts: number; backoffMs: number },
  ): Promise<{
    data: Record<string, unknown>;
    attemptCount: number;
    credentialId?: string;
    connectorId?: string;
  }> {
    const auth = await this.resolveHttpAuth(tenantId, toolName);
    const result = await this.http.invoke({
      url: joinSafeUrl(auth.baseUrl, HTTP_PATHS[toolName]),
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        [auth.headerName]: auth.headerValue,
      },
      body: { tenantId, ...args },
      timeoutMs: retry.timeoutMs,
      maxAttempts: retry.maxAttempts,
      backoffMs: retry.backoffMs,
    });

    if (result.status >= 400) {
      throw new ToolExecutionError(`Connector returned HTTP ${result.status}`);
    }

    return {
      data: result.data,
      attemptCount: result.attemptCount,
      credentialId: auth.credentialId,
      connectorId: auth.connectorId,
    };
  }

  private async resolveHttpAuth(
    tenantId: string,
    toolName: Extract<ToolName, 'getOrderDetails' | 'checkRefundStatus'>,
  ): Promise<{
    baseUrl: string;
    headerName: string;
    headerValue: string;
    credentialId?: string;
    connectorId?: string;
  }> {
    const providers = HTTP_TOOL_PROVIDERS[toolName];
    for (const provider of providers) {
      const connector = await this.connectors.findByProvider(tenantId, provider);
      if (connector?.isConnected && connector.accessToken) {
        let current = connector;
        if (current.accessTokenExpired(this.clock.now()) && current.refreshToken) {
          const clientSecret = this.cipher.decrypt(
            current.clientSecret.ciphertext,
            current.clientSecret.nonce,
          );
          const refreshToken = this.cipher.decrypt(
            current.refreshToken.ciphertext,
            current.refreshToken.nonce,
          );
          const tokens = await this.oauth.refreshAccessToken({
            tokenUrl: current.tokenUrl,
            clientId: current.clientId,
            clientSecret,
            refreshToken,
          });
          const now = this.clock.now();
          current = current.connect({
            accessToken: this.cipher.encrypt(tokens.accessToken),
            refreshToken: tokens.refreshToken
              ? this.cipher.encrypt(tokens.refreshToken)
              : current.refreshToken,
            tokenExpiresAt:
              tokens.expiresInSeconds !== undefined
                ? new Date(now.getTime() + tokens.expiresInSeconds * 1000)
                : current.tokenExpiresAt,
            externalAccountId: tokens.externalAccountId ?? current.externalAccountId,
            now,
          });
          await this.connectors.save(current);
        }

        if (!current.accessToken) {
          continue;
        }
        const accessToken = this.cipher.decrypt(
          current.accessToken.ciphertext,
          current.accessToken.nonce,
        );
        return {
          baseUrl: originFromUrl(current.tokenUrl),
          headerName: 'Authorization',
          headerValue: `Bearer ${accessToken}`,
          connectorId: current.id,
        };
      }
    }

    const credential = await this.credentials.findActiveByTool(tenantId, toolName);
    if (!credential) {
      throw new ToolCredentialRequiredError();
    }
    const secret = this.cipher.decrypt(credential.secret.ciphertext, credential.secret.nonce);
    const header = credential.authorizationHeader(secret);
    return {
      baseUrl: credential.baseUrl,
      headerName: header.name,
      headerValue: header.value,
      credentialId: credential.id,
    };
  }

  private async publish(invocation: ToolInvocation, correlationId?: string): Promise<void> {
    await this.eventBus.publish(
      new ToolCallExecutedEvent(
        crypto.randomUUID(),
        invocation.completedAt ?? invocation.createdAt,
        invocation.organizationId,
        invocation.id,
        invocation.toolName,
        invocation.status,
        correlationId,
      ),
    );
  }
}

function originFromUrl(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function asHttpToolName(name: ToolName): Extract<ToolName, 'getOrderDetails' | 'checkRefundStatus'> {
  if (name === 'getOrderDetails' || name === 'checkRefundStatus') {
    return name;
  }
  throw new ToolExecutionError();
}
