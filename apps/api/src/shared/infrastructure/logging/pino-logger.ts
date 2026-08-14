import type { AppConfig } from '@ai-customer-support/config';
import type { Logger } from '@ai-customer-support/shared';
import pino, { type Logger as PinoBaseLogger } from 'pino';

export function createRootLogger(config: AppConfig): PinoBaseLogger {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: 'api' },
    redact: {
      paths: [
        'password',
        'token',
        'secret',
        'authorization',
        'jwt',
        'apiKey',
        'api_key',
        'DATABASE_URL',
        'REDIS_URL',
        'JWT_SECRET',
        'GOOGLE_CLIENT_SECRET',
        'SMTP_URL',
      ],
      censor: '[redacted]',
    },
    ...(config.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } } }
      : {}),
  });
}

export class PinoLogger implements Logger {
  constructor(private readonly pino: PinoBaseLogger) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.pino.debug(context ?? {}, message);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.pino.info(context ?? {}, message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.pino.warn(context ?? {}, message);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.pino.error(context ?? {}, message);
  }

  child(bindings: Record<string, unknown>): Logger {
    return new PinoLogger(this.pino.child(bindings));
  }

  unwrap(): PinoBaseLogger {
    return this.pino;
  }
}
