import type { Logger } from '@ai-customer-support/shared';
import type { Logger as PinoBaseLogger } from 'pino';

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
}
