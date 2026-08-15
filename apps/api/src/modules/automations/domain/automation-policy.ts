import { InsufficientAutomationPermissionError } from './errors.js';

export class AutomationPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientAutomationPermissionError(permission);
    }
  }
}

export const SYSTEM_ACTOR_ID = 'system';
export const MAX_RULES_PER_TENANT = 100;
export const MAX_LOG_MESSAGE = 2_000;
export const DISPATCH_INTERVAL_MS = 5_000;
export const DISPATCH_BATCH_SIZE = 50;
export const STALE_RUNNING_MS = 5 * 60_000;
export const AUTOMATION_EXECUTE_QUEUE = 'automation.execute';
