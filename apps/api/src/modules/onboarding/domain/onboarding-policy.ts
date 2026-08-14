import { InsufficientOnboardingPermissionError } from './errors.js';

export class OnboardingPolicy {
  static assertPermission(permissions: readonly string[], permission: string): void {
    if (!permissions.includes(permission)) {
      throw new InsufficientOnboardingPermissionError(permission);
    }
  }
}
