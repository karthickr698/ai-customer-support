import type { ClockPort } from '../../../application/ports/tenant-access-port.js';

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
