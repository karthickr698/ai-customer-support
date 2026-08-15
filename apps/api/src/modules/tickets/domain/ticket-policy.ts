import { AssigneeNotAssignableError, InsufficientTicketPermissionError } from './errors.js';

const ASSIGNABLE_ROLES = new Set(['owner', 'admin', 'agent']);

export class TicketPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientTicketPermissionError(permission);
    }
  }

  static assertAssignableRole(role: string): void {
    if (!ASSIGNABLE_ROLES.has(role)) {
      throw new AssigneeNotAssignableError();
    }
  }
}

export const SYSTEM_ACTOR_ID = 'system';
export const MAX_TICKETS_PER_TENANT = 50_000;
export const MAX_SLA_POLICIES_PER_TENANT = 20;
export const MAX_ESCALATION_POLICIES_PER_TENANT = 50;
export const MAX_TICKET_NOTES = 500;
export const SLA_EVALUATION_INTERVAL_MS = 30_000;
export const MAX_SLA_CANDIDATES = 500;
