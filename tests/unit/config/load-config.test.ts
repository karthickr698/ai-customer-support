import { ConfigurationError, loadConfig } from '@ai-customer-support/config';
import { describe, expect, it } from 'vitest';

const validEnv = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: '3001',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ai_customer_support',
  REDIS_URL: 'redis://localhost:6380',
  JWT_SECRET: 'change-me-to-a-long-random-secret-key',
  WEB_ORIGIN: 'http://localhost:5173',
};

describe('loadConfig', () => {
  it('loads typed configuration from the environment', () => {
    const config = loadConfig(validEnv);

    expect(config.PORT).toBe(3001);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.DATABASE_URL).toContain('postgresql://');
    expect(config.REDIS_URL).toContain('redis://');
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('applies safe defaults for host, port, and web origin', () => {
    const config = loadConfig({
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
    });

    expect(config.NODE_ENV).toBe('development');
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.PORT).toBe(3000);
    expect(config.WEB_ORIGIN).toBe('http://localhost:5173');
    expect(config.AI_SERVICE_URL).toBe('http://localhost:8000');
    expect(config.ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(config.EMAIL_FROM).toBe('noreply@localhost');
    expect(config.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('treats empty Google and SMTP settings as unset', () => {
    const config = loadConfig({
      ...validEnv,
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GOOGLE_REDIRECT_URI: '',
      SMTP_URL: '',
    });

    expect(config.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(config.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(config.GOOGLE_REDIRECT_URI).toBeUndefined();
    expect(config.SMTP_URL).toBeUndefined();
  });

  it('defaults log level from the environment when unset', () => {
    const { LOG_LEVEL: _, ...withoutLevel } = validEnv;

    expect(loadConfig({ ...withoutLevel, NODE_ENV: 'development' }).LOG_LEVEL).toBe('debug');
    expect(loadConfig({ ...withoutLevel, NODE_ENV: 'test' }).LOG_LEVEL).toBe('error');
    expect(
      loadConfig({
        ...withoutLevel,
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(32),
      }).LOG_LEVEL,
    ).toBe('info');
  });

  it('rejects missing required secrets', () => {
    expect(() => loadConfig({ ...validEnv, JWT_SECRET: 'short' })).toThrow(ConfigurationError);
  });

  it('rejects missing database and redis urls', () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: undefined })).toThrow(ConfigurationError);
    expect(() => loadConfig({ ...validEnv, REDIS_URL: undefined })).toThrow(ConfigurationError);
  });

  it('rejects non-postgres and non-redis connection strings', () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      ConfigurationError,
    );
    expect(() => loadConfig({ ...validEnv, REDIS_URL: 'http://localhost:6380' })).toThrow(
      ConfigurationError,
    );
  });

  it('rejects the example JWT secret in production', () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-to-a-long-random-secret-key',
      }),
    ).toThrow(ConfigurationError);
  });

  it('does not load LLM provider settings for the TypeScript API', () => {
    const config = loadConfig({
      ...validEnv,
      LLM_PROVIDER: 'openai',
      LLM_API_KEY: 'sk-test',
    });

    expect(config).not.toHaveProperty('LLM_PROVIDER');
    expect(config).not.toHaveProperty('LLM_API_KEY');
    expect(config.AI_SERVICE_URL).toBe('http://localhost:8000');
  });
});
