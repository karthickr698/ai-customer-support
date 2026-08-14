import type { AppDependencies } from './dependencies.js';

export function initializeApplication(deps: AppDependencies): void {
  deps.agents?.start();
  deps.conversations?.start();
}
