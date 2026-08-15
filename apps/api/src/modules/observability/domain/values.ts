import {
  OBSERVABILITY_EVALUATION_VERDICTS,
  OBSERVABILITY_INCIDENT_SEVERITIES,
  OBSERVABILITY_INCIDENT_SOURCES,
  OBSERVABILITY_INCIDENT_STATUSES,
  OBSERVABILITY_LOG_LEVELS,
  OBSERVABILITY_SERVICES,
  OBSERVABILITY_SPAN_KINDS,
  OBSERVABILITY_SPAN_STATUSES,
  type ObservabilityEvaluationVerdict,
  type ObservabilityIncidentSeverity,
  type ObservabilityIncidentSource,
  type ObservabilityIncidentStatus,
  type ObservabilityLogLevel,
  type ObservabilityService,
  type ObservabilitySpanKind,
  type ObservabilitySpanStatus,
} from '@ai-customer-support/contracts';
import { InvalidObservabilityError } from './errors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY_PATTERN = /(password|secret|token|authorization|jwt|api[_-]?key|cookie)/i;

export function parseLogLevel(value: string): ObservabilityLogLevel {
  if (!(OBSERVABILITY_LOG_LEVELS as readonly string[]).includes(value)) {
    throw new InvalidObservabilityError('Log level must be debug, info, warn, or error');
  }
  return value as ObservabilityLogLevel;
}

export function parseService(value: string): ObservabilityService {
  if (!(OBSERVABILITY_SERVICES as readonly string[]).includes(value)) {
    throw new InvalidObservabilityError('Service must be api or ai');
  }
  return value as ObservabilityService;
}

export function parseSpanKind(value: string): ObservabilitySpanKind {
  if (!(OBSERVABILITY_SPAN_KINDS as readonly string[]).includes(value)) {
    throw new InvalidObservabilityError('Span kind must be server, client, or internal');
  }
  return value as ObservabilitySpanKind;
}

export function parseSpanStatus(value: string): ObservabilitySpanStatus {
  if (!(OBSERVABILITY_SPAN_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidObservabilityError('Span status must be ok or error');
  }
  return value as ObservabilitySpanStatus;
}

export function parseIncidentSource(value: string): ObservabilityIncidentSource {
  if (!(OBSERVABILITY_INCIDENT_SOURCES as readonly string[]).includes(value)) {
    throw new InvalidObservabilityError('Incident source must be http, ai, health, or evaluation');
  }
  return value as ObservabilityIncidentSource;
}

export function parseIncidentSeverity(value: string): ObservabilityIncidentSeverity {
  if (!(OBSERVABILITY_INCIDENT_SEVERITIES as readonly string[]).includes(value)) {
    throw new InvalidObservabilityError('Severity must be low, medium, high, or critical');
  }
  return value as ObservabilityIncidentSeverity;
}

export function parseIncidentStatus(value: string): ObservabilityIncidentStatus {
  if (!(OBSERVABILITY_INCIDENT_STATUSES as readonly string[]).includes(value)) {
    throw new InvalidObservabilityError('Incident status must be open, acknowledged, or resolved');
  }
  return value as ObservabilityIncidentStatus;
}

export function parseEvaluationVerdict(value: string): ObservabilityEvaluationVerdict {
  if (!(OBSERVABILITY_EVALUATION_VERDICTS as readonly string[]).includes(value)) {
    throw new InvalidObservabilityError('Evaluation verdict must be passed, degraded, or failed');
  }
  return value as ObservabilityEvaluationVerdict;
}

export function requireUuid(value: string, label: string): string {
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new InvalidObservabilityError(`${label} must be a UUID`);
  }
  return trimmed;
}

export function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function stringRecord(value: unknown): Record<string, string> {
  const record = jsonRecord(value);
  if (!record) {
    return {};
  }
  const labels: Record<string, string> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === 'string') {
      labels[key] = entry;
    }
  }
  return labels;
}

export function redactAttributes(
  attributes: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!attributes) {
    return undefined;
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : value;
  }
  return redacted;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function minuteBucket(at: Date): Date {
  const bucket = new Date(at);
  bucket.setUTCSeconds(0, 0);
  return bucket;
}
