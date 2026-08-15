import { InvalidAutomationError } from './errors.js';

export type AutomationSchedule =
  | { readonly kind: 'every'; readonly minutes: number }
  | { readonly kind: 'hourly'; readonly minute: number }
  | { readonly kind: 'daily'; readonly hour: number; readonly minute: number }
  | { readonly kind: 'weekly'; readonly weekday: number; readonly hour: number; readonly minute: number };

const EVERY_PATTERN = /^every:(\d{1,4})m$/;
const HOURLY_PATTERN = /^hourly:(\d{1,2})$/;
const DAILY_PATTERN = /^daily:(\d{2}):(\d{2})$/;
const WEEKLY_PATTERN = /^weekly:([0-6]):(\d{2}):(\d{2})$/;

export function parseSchedule(raw: string): AutomationSchedule {
  const value = raw.trim();
  const every = EVERY_PATTERN.exec(value);
  if (every) {
    const minutes = Number(every[1]);
    if (minutes < 1 || minutes > 1_440) {
      throw new InvalidAutomationError('every:Nm interval must be between 1 and 1440 minutes');
    }
    return { kind: 'every', minutes };
  }
  const hourly = HOURLY_PATTERN.exec(value);
  if (hourly) {
    const minute = Number(hourly[1]);
    if (minute < 0 || minute > 59) {
      throw new InvalidAutomationError('hourly:MM minute must be between 0 and 59');
    }
    return { kind: 'hourly', minute };
  }
  const daily = DAILY_PATTERN.exec(value);
  if (daily) {
    return { kind: 'daily', hour: parseHour(daily[1] ?? ''), minute: parseMinute(daily[2] ?? '') };
  }
  const weekly = WEEKLY_PATTERN.exec(value);
  if (weekly) {
    return {
      kind: 'weekly',
      weekday: Number(weekly[1]),
      hour: parseHour(weekly[2] ?? ''),
      minute: parseMinute(weekly[3] ?? ''),
    };
  }
  throw new InvalidAutomationError(
    'Schedule must be every:{n}m, hourly:{mm}, daily:{HH:MM}, or weekly:{0-6}:{HH:MM}',
  );
}

export function formatSchedule(schedule: AutomationSchedule): string {
  if (schedule.kind === 'every') {
    return `every:${schedule.minutes}m`;
  }
  if (schedule.kind === 'hourly') {
    return `hourly:${String(schedule.minute)}`;
  }
  if (schedule.kind === 'daily') {
    return `daily:${pad(schedule.hour)}:${pad(schedule.minute)}`;
  }
  return `weekly:${schedule.weekday}:${pad(schedule.hour)}:${pad(schedule.minute)}`;
}

export function computeNextRun(fromExclusive: Date, schedule: AutomationSchedule): Date {
  if (schedule.kind === 'every') {
    return new Date(fromExclusive.getTime() + schedule.minutes * 60_000);
  }
  if (schedule.kind === 'hourly') {
    const candidate = new Date(fromExclusive);
    candidate.setUTCSeconds(0, 0);
    candidate.setUTCMinutes(schedule.minute);
    if (candidate.getTime() <= fromExclusive.getTime()) {
      candidate.setUTCHours(candidate.getUTCHours() + 1);
    }
    return candidate;
  }
  if (schedule.kind === 'daily') {
    const candidate = atUtcTime(fromExclusive, schedule.hour, schedule.minute);
    if (candidate.getTime() <= fromExclusive.getTime()) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    return candidate;
  }
  const candidate = atUtcTime(fromExclusive, schedule.hour, schedule.minute);
  const delta = (schedule.weekday - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + delta);
  if (candidate.getTime() <= fromExclusive.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  return candidate;
}

function atUtcTime(from: Date, hour: number, minute: number): Date {
  const candidate = new Date(from);
  candidate.setUTCHours(hour, minute, 0, 0);
  return candidate;
}

function parseHour(value: string): number {
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new InvalidAutomationError('Hour must be between 00 and 23');
  }
  return hour;
}

function parseMinute(value: string): number {
  const minute = Number(value);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new InvalidAutomationError('Minute must be between 00 and 59');
  }
  return minute;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
