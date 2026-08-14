import { InsufficientPermissionError } from '../../organizations/domain/errors.js';

export class AgentPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientPermissionError(permission);
    }
  }
}
