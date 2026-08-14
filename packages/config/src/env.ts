import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  LLM_PROVIDER: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new ConfigurationError(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }

  return parsed.data;
}
