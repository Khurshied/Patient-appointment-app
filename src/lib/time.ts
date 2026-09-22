import { DateTime } from "luxon";
import { WEEKDAY_KEYS, type TimeInterval, type WeekdayKey } from "./domain";

export function weekdayKey(dt: DateTime): WeekdayKey {
  return WEEKDAY_KEYS[dt.weekday - 1];
}

export function parseHm(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function localOnDate(
  date: string,
  hm: string,
  timezone: string,
): DateTime | null {
  const parsed = parseHm(hm);
  const day = DateTime.fromISO(date, { zone: timezone });
  if (!parsed || !day.isValid) return null;
  return DateTime.fromObject(
    {
      year: day.year,
      month: day.month,
      day: day.day,
      hour: parsed.hour,
      minute: parsed.minute,
      second: 0,
      millisecond: 0,
    },
    { zone: timezone },
  );
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function parseOffsetToMinutes(offset: string): number | null {
  const match = /^(\d+)(h|m)$/i.exec(offset.trim());
  if (!match) return null;
  const n = Number(match[1]);
  if (match[2].toLowerCase() === "h") return n * 60;
  return n;
}

export function isValidIanaZone(zone: string): boolean {
  return DateTime.now().setZone(zone).isValid;
}

export function toIsoUtc(date: Date): string {
  return DateTime.fromJSDate(date, { zone: "utc" }).toISO({
    suppressMilliseconds: false,
  })!;
}

export function intervalToUtcRange(
  date: string,
  interval: TimeInterval,
  timezone: string,
): { start: Date; end: Date } | null {
  const start = localOnDate(date, interval.start, timezone);
  const end = localOnDate(date, interval.end, timezone);
  if (!start || !end || !start.isValid || !end.isValid || end <= start) {
    return null;
  }
  return { start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() };
}
