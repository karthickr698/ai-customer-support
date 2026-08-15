import type { ClockPort } from '../../application/ports.js';

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
