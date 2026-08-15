import type { ObservabilityIncidentSeverity } from '@ai-customer-support/contracts';

export type FailureWindow = {
  readonly total: number;
  readonly errors: number;
};

export class FailurePolicy {
  static shouldOpenFromErrorRate(input: {
    readonly window: FailureWindow;
    readonly threshold: number;
    readonly minSampleSize: number;
  }): boolean {
    if (input.window.total < input.minSampleSize) {
      return false;
    }
    return input.window.errors / input.window.total >= input.threshold;
  }

  static shouldOpenFromConsecutiveFailures(failures: number, threshold: number): boolean {
    return failures >= threshold;
  }

  static severityForHttp(statusCode: number, errorRate: number): ObservabilityIncidentSeverity {
    if (statusCode >= 500 && errorRate >= 0.5) {
      return 'critical';
    }
    if (statusCode >= 500) {
      return 'high';
    }
    return 'medium';
  }

  static severityForAi(consecutiveFailures: number): ObservabilityIncidentSeverity {
    return consecutiveFailures >= 10 ? 'critical' : 'high';
  }

  static severityForEvaluation(verdict: 'degraded' | 'failed'): ObservabilityIncidentSeverity {
    return verdict === 'failed' ? 'medium' : 'low';
  }
}
