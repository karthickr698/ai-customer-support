import { Permissions } from '../../organizations/domain/permissions.js';
import { InsufficientIntegrationPermissionError } from './errors.js';
import type { ToolDefinitionDto } from '@ai-customer-support/contracts';

export class IntegrationPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientIntegrationPermissionError(permission);
    }
  }

  static assertCanManage(permissions: readonly string[]): void {
    IntegrationPolicy.assertPermission(permissions, Permissions.INTEGRATION_MANAGE);
  }

  static assertCanExecute(permissions: readonly string[], tool: ToolDefinitionDto): void {
    IntegrationPolicy.assertPermission(permissions, tool.permission);
  }

  static assertCanListAudit(permissions: readonly string[]): void {
    if (
      !permissions.includes(Permissions.ORGANIZATION_AUDIT_VIEW) &&
      !permissions.includes(Permissions.INTEGRATION_MANAGE)
    ) {
      throw new InsufficientIntegrationPermissionError(Permissions.ORGANIZATION_AUDIT_VIEW);
    }
  }
}
