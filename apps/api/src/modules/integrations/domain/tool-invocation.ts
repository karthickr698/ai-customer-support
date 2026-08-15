import type {
  ToolActorType,
  ToolInvocationStatus,
  ToolName,
} from '@ai-customer-support/contracts';
import { TOOL_ACTOR_TYPES, TOOL_INVOCATION_STATUSES } from '@ai-customer-support/contracts';
import { InvalidToolCallError } from './errors.js';
import { createToolInvocationId, type ToolInvocationId } from './ids.js';
import { parseToolName } from './tool-catalog.js';

export type ToolInvocationSnapshot = {
  readonly id: ToolInvocationId;
  readonly organizationId: string;
  readonly toolName: ToolName;
  readonly conversationId?: string;
  readonly actorId?: string;
  readonly actorType: ToolActorType;
  readonly status: ToolInvocationStatus;
  readonly arguments: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly attemptCount: number;
  readonly durationMs: number;
  readonly credentialId?: string;
  readonly connectorId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly createdAt: Date;
  readonly completedAt?: Date;
};

export class ToolInvocation {
  private constructor(
    readonly id: ToolInvocationId,
    readonly organizationId: string,
    readonly toolName: ToolName,
    readonly conversationId: string | undefined,
    readonly actorId: string | undefined,
    readonly actorType: ToolActorType,
    readonly status: ToolInvocationStatus,
    readonly argumentPayload: Record<string, unknown>,
    readonly result: Record<string, unknown> | undefined,
    readonly errorCode: string | undefined,
    readonly errorMessage: string | undefined,
    readonly attemptCount: number,
    readonly durationMs: number,
    readonly credentialId: string | undefined,
    readonly connectorId: string | undefined,
    readonly ipAddress: string | undefined,
    readonly userAgent: string | undefined,
    readonly requestId: string | undefined,
    readonly correlationId: string | undefined,
    readonly createdAt: Date,
    readonly completedAt: Date | undefined,
  ) {}

  static start(input: {
    readonly organizationId: string;
    readonly toolName: string;
    readonly argumentPayload: Record<string, unknown>;
    readonly actorType?: string;
    readonly actorId?: string;
    readonly conversationId?: string;
    readonly credentialId?: string;
    readonly connectorId?: string;
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
    readonly correlationId?: string;
    readonly now: Date;
    readonly id?: ToolInvocationId;
  }): ToolInvocation {
    return new ToolInvocation(
      input.id ?? createToolInvocationId(),
      input.organizationId,
      parseToolName(input.toolName),
      input.conversationId,
      input.actorId,
      parseActorType(input.actorType ?? 'user'),
      'accepted',
      sanitizeJson(input.argumentPayload),
      undefined,
      undefined,
      undefined,
      0,
      0,
      input.credentialId,
      input.connectorId,
      input.ipAddress,
      input.userAgent,
      input.requestId,
      input.correlationId,
      input.now,
      undefined,
    );
  }

  withExecutionRefs(input: { readonly credentialId?: string; readonly connectorId?: string }): ToolInvocation {
    return new ToolInvocation(
      this.id,
      this.organizationId,
      this.toolName,
      this.conversationId,
      this.actorId,
      this.actorType,
      this.status,
      this.argumentPayload,
      this.result,
      this.errorCode,
      this.errorMessage,
      this.attemptCount,
      this.durationMs,
      input.credentialId,
      input.connectorId,
      this.ipAddress,
      this.userAgent,
      this.requestId,
      this.correlationId,
      this.createdAt,
      this.completedAt,
    );
  }

  static reconstitute(snapshot: ToolInvocationSnapshot): ToolInvocation {
    return new ToolInvocation(
      snapshot.id,
      snapshot.organizationId,
      snapshot.toolName,
      snapshot.conversationId,
      snapshot.actorId,
      snapshot.actorType,
      snapshot.status,
      snapshot.arguments,
      snapshot.result,
      snapshot.errorCode,
      snapshot.errorMessage,
      snapshot.attemptCount,
      snapshot.durationMs,
      snapshot.credentialId,
      snapshot.connectorId,
      snapshot.ipAddress,
      snapshot.userAgent,
      snapshot.requestId,
      snapshot.correlationId,
      snapshot.createdAt,
      snapshot.completedAt,
    );
  }

  complete(input: {
    readonly status: Exclude<ToolInvocationStatus, 'accepted'>;
    readonly result?: Record<string, unknown>;
    readonly errorCode?: string;
    readonly errorMessage?: string;
    readonly attemptCount: number;
    readonly now: Date;
  }): ToolInvocation {
    return new ToolInvocation(
      this.id,
      this.organizationId,
      this.toolName,
      this.conversationId,
      this.actorId,
      this.actorType,
      input.status,
      this.argumentPayload,
      input.result ? sanitizeJson(input.result) : undefined,
      input.errorCode,
      input.errorMessage,
      input.attemptCount,
      Math.max(0, input.now.getTime() - this.createdAt.getTime()),
      this.credentialId,
      this.connectorId,
      this.ipAddress,
      this.userAgent,
      this.requestId,
      this.correlationId,
      this.createdAt,
      input.now,
    );
  }

  toSnapshot(): ToolInvocationSnapshot {
    return {
      id: this.id,
      organizationId: this.organizationId,
      toolName: this.toolName,
      conversationId: this.conversationId,
      actorId: this.actorId,
      actorType: this.actorType,
      status: this.status,
      arguments: this.argumentPayload,
      result: this.result,
      errorCode: this.errorCode,
      errorMessage: this.errorMessage,
      attemptCount: this.attemptCount,
      durationMs: this.durationMs,
      credentialId: this.credentialId,
      connectorId: this.connectorId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      requestId: this.requestId,
      correlationId: this.correlationId,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
    };
  }
}

function parseActorType(value: string): ToolActorType {
  if (!(TOOL_ACTOR_TYPES as readonly string[]).includes(value)) {
    throw new InvalidToolCallError('Invalid tool actor type');
  }
  return value as ToolActorType;
}

export function parseInvocationStatus(value: string): ToolInvocationStatus {
  if (!(TOOL_INVOCATION_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidToolCallError('Invalid tool invocation status');
  }
  return value as ToolInvocationStatus;
}

const SECRET_KEYS = new Set([
  'secret',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'authorization',
  'apiKey',
]);

function sanitizeJson(value: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEYS.has(key) || key.toLowerCase().includes('secret')) {
      output[key] = '[redacted]';
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      output[key] = sanitizeJson(item as Record<string, unknown>);
      continue;
    }
    output[key] = item;
  }
  return output;
}
