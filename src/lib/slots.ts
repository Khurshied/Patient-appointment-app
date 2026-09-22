import { DateTime } from "luxon";
import type {
  HoursModeId,
  TimeInterval,
  WeeklyHours,
  WeekdayKey,
} from "./domain";
import { SLOT_STEP_MINUTES } from "./domain";
import {
  appointmentOccupiesCalendar,
  isWindowOccupied,
  type OccupyingAppointment,
} from "./contention";
import type { ContentionPolicyId } from "./domain";
import { localOnDate, weekdayKey } from "./time";

export type HourExceptionInput = {
  date: string;
  kind: "open" | "closed";
  intervals: TimeInterval[];
};

export type GenerateSlotsInput = {
  date: string;
  timezone: string;
  durationMinutes: number;
  hoursMode: HoursModeId;
  weeklyHours: WeeklyHours;
  exceptions: HourExceptionInput[];
  blocks: { start: Date; end: Date }[];
  appointments: OccupyingAppointment[];
  contentionPolicy: ContentionPolicyId;
  now?: Date;
};

export type OpenInterval = { start: DateTime; end: DateTime };

function asDateKey(date: string | Date, timezone: string): string {
  if (typeof date === "string") return date;
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone).toISODate()!;
}

export function resolveOpenIntervals(args: {
  date: string;
  timezone: string;
  hoursMode: HoursModeId;
  weeklyHours: WeeklyHours;
  exceptions: HourExceptionInput[];
}): OpenInterval[] {
  const { date, timezone, hoursMode, weeklyHours, exceptions } = args;
  const day = DateTime.fromISO(date, { zone: timezone });
  if (!day.isValid) return [];

  const useWeekly =
    hoursMode === "weekly_template" || hoursMode === "both";
  const useExceptions =
    hoursMode === "exceptions_enabled" || hoursMode === "both";

  const key: WeekdayKey = weekdayKey(day);
  let intervals: TimeInterval[] = useWeekly ? (weeklyHours[key] ?? []) : [];

  if (useExceptions) {
    const forDay = exceptions.filter((ex) => asDateKey(ex.date, timezone) === date);
    const closed = forDay.find((ex) => ex.kind === "closed");
    if (closed) {
      intervals = [];
    }
    for (const ex of forDay) {
      if (ex.kind === "open") {
        intervals = [...intervals, ...ex.intervals];
      }
    }
  }

  const resolved: OpenInterval[] = [];
  for (const interval of intervals) {
    const start = localOnDate(date, interval.start, timezone);
    const end = localOnDate(date, interval.end, timezone);
    if (!start || !end || end <= start) continue;
    resolved.push({ start, end });
  }

  resolved.sort((a, b) => a.start.toMillis() - b.start.toMillis());
  return mergeIntervals(resolved);
}

function mergeIntervals(intervals: OpenInterval[]): OpenInterval[] {
  if (intervals.length === 0) return [];
  const out: OpenInterval[] = [{ ...intervals[0] }];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

export function generateSlots(input: GenerateSlotsInput): Date[] {
  if (input.durationMinutes <= 0) return [];
  const now = input.now ?? new Date();
  const open = resolveOpenIntervals(input);
  const slots: Date[] = [];

  for (const window of open) {
    let cursor = window.start;
    const latestStart = window.end.minus({ minutes: input.durationMinutes });
    while (cursor <= latestStart) {
      const startJs = cursor.toUTC().toJSDate();
      if (startJs >= now) {
        const occupied = isWindowOccupied({
          start: startJs,
          durationMinutes: input.durationMinutes,
          policy: input.contentionPolicy,
          appointments: input.appointments,
          blocks: input.blocks,
        });
        if (!occupied) {
          slots.push(startJs);
        }
      }
      cursor = cursor.plus({ minutes: SLOT_STEP_MINUTES });
    }
  }

  return slots;
}

export { appointmentOccupiesCalendar };
