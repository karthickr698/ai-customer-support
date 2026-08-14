import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = {
  '@ai-customer-support/shared': fileURLToPath(
    new URL('./packages/shared/src/index.ts', import.meta.url),
  ),
  '@ai-customer-support/config': fileURLToPath(
    new URL('./packages/config/src/index.ts', import.meta.url),
  ),
  '@ai-customer-support/contracts': fileURLToPath(
    new URL('./packages/contracts/src/index.ts', import.meta.url),
  ),
};

export default defineConfig({
  resolve: { alias },
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
