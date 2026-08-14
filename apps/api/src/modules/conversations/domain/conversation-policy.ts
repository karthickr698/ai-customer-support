import { AssigneeNotAssignableError, InsufficientConversationPermissionError } from './errors.js';

const ASSIGNABLE_ROLES = new Set(['owner', 'admin', 'agent']);

export class ConversationPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientConversationPermissionError(permission);
    }
  }

  static assertAssignableRole(role: string): void {
    if (!ASSIGNABLE_ROLES.has(role)) {
      throw new AssigneeNotAssignableError();
    }
  }
}
