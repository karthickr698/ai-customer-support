import { InsufficientAiAgentPermissionError } from './errors.js';

export class AiAgentConfigurationPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientAiAgentPermissionError(permission);
    }
  }
}
