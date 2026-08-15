import type { AppDependencies } from './dependencies.js';

export async function initializeApplication(deps: AppDependencies): Promise<void> {
  deps.agents?.start();
  deps.conversations?.start();
  deps.tickets?.start();
  deps.automations?.start();
  deps.notifications?.start();
  await deps.billing?.start();
}
