import { z } from 'zod';

const environments = ['development', 'test', 'production'] as const;
const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

const EXAMPLE_JWT_SECRET = 'change-me-to-a-long-random-secret-key';

function emptyToUndefined(value: unknown): unknown {
  return value === '' ? undefined : value;
}

const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(environments).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(logLevels).optional(),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
      'DATABASE_URL must be a PostgreSQL connection string',
    ),
  REDIS_URL: z
    .string()
    .min(1)
    .refine(
      (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
      'REDIS_URL must be a Redis connection string',
    ),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  EMAIL_VERIFICATION_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(3_600),
  INVITATION_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  EMAIL_FROM: z.string().min(1).default('noreply@localhost'),
  SMTP_URL: optionalSecret,
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  GOOGLE_REDIRECT_URI: optionalUrl,
});

export type AppConfig = Omit<z.infer<typeof envSchema>, 'LOG_LEVEL'> & {
  readonly LOG_LEVEL: (typeof logLevels)[number];
};

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function defaultLogLevel(env: (typeof environments)[number]): AppConfig['LOG_LEVEL'] {
  if (env === 'production') {
    return 'info';
  }
  if (env === 'test') {
    return 'error';
  }
  return 'debug';
}

function assertProductionSecrets(config: AppConfig): void {
  if (config.NODE_ENV !== 'production') {
    return;
  }

  if (config.JWT_SECRET === EXAMPLE_JWT_SECRET) {
    throw new ConfigurationError('JWT_SECRET must not use the example value in production');
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new ConfigurationError(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }

  const config: AppConfig = {
    ...parsed.data,
    LOG_LEVEL: parsed.data.LOG_LEVEL ?? defaultLogLevel(parsed.data.NODE_ENV),
  };

  assertProductionSecrets(config);

  return config;
}

export function isGoogleOAuthConfigured(config: AppConfig): boolean {
  return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REDIRECT_URI);
}
