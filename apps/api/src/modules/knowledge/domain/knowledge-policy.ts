import { InsufficientKnowledgePermissionError } from './errors.js';

export class KnowledgePolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientKnowledgePermissionError(permission);
    }
  }
}
