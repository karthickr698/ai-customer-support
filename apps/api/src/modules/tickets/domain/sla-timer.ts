import type { TicketPriority } from '@ai-customer-support/contracts';
import { InvalidTicketError } from './errors.js';

export const DEFAULT_SLA_MINUTES: Record<
  TicketPriority,
  { readonly firstResponseMinutes: number; readonly resolutionMinutes: number }
> = {
  low: { firstResponseMinutes: 480, resolutionMinutes: 4_320 },
  normal: { firstResponseMinutes: 60, resolutionMinutes: 1_440 },
  high: { firstResponseMinutes: 30, resolutionMinutes: 480 },
  urgent: { firstResponseMinutes: 15, resolutionMinutes: 240 },
};

export type SlaTargets = {
  readonly firstResponseMinutes: number;
  readonly resolutionMinutes: number;
};

export function addMinutes(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * 60_000);
}

export function elapsedMs(from: Date, to: Date): number {
  return Math.max(0, to.getTime() - from.getTime());
}

export function shiftDueDate(due: Date | undefined, elapsed: number): Date | undefined {
  if (!due) {
    return undefined;
  }
  return new Date(due.getTime() + elapsed);
}

export function isDue(due: Date | undefined, now: Date): boolean {
  return Boolean(due && now.getTime() >= due.getTime());
}

export function parseSlaMinutes(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 10_080) {
    throw new InvalidTicketError(`${label} must be between 1 and 10080 minutes`);
  }
  return value;
}
