import { ConfigurationError, loadConfig } from '@ai-customer-support/config';
import { describe, expect, it } from 'vitest';

const validEnv = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3001',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_customer_support',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'change-me-to-a-long-random-secret-key',
  WEB_ORIGIN: 'http://localhost:5173',
};

describe('loadConfig', () => {
  it('loads typed configuration from the environment', () => {
    const config = loadConfig(validEnv);

    expect(config.PORT).toBe(3001);
    expect(config.DATABASE_URL).toContain('postgresql://');
    expect(config.REDIS_URL).toContain('redis://');
  });

  it('rejects missing required secrets', () => {
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'short' })).toThrow(ConfigurationError);
  });
});
