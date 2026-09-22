import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { generateSlots, resolveOpenIntervals } from "./slots";
import { defaultWeeklyHours } from "./domain";

const TZ = "Asia/Kolkata";

function utc(isoLocal: string) {
  return DateTime.fromISO(isoLocal, { zone: TZ }).toUTC().toJSDate();
}

describe("slot generation", () => {
  it("generates 15-minute starts inside Mon-Fri hours and skips lunch", () => {
    const slots = generateSlots({
      date: "2026-09-21",
      timezone: TZ,
      durationMinutes: 30,
      hoursMode: "both",
      weeklyHours: defaultWeeklyHours(),
      exceptions: [],
      blocks: [],
      appointments: [],
      contentionPolicy: "hide_on_request",
      now: utc("2026-09-01T00:00"),
    });
    const locals = slots.map((s) =>
      DateTime.fromJSDate(s, { zone: "utc" }).setZone(TZ).toFormat("HH:mm"),
    );
    expect(locals[0]).toBe("09:00");
    expect(locals).toContain("12:30");
    expect(locals).not.toContain("12:45");
    expect(locals).not.toContain("13:00");
    expect(locals).toContain("14:00");
    expect(locals).toContain("16:30");
    expect(locals).not.toContain("16:45");
    expect(new Set(locals).size).toBe(locals.length);
  });

  it("does not emit Saturday slots from the weekly template", () => {
    const slots = generateSlots({
      date: "2026-09-19",
      timezone: TZ,
      durationMinutes: 30,
      hoursMode: "both",
      weeklyHours: defaultWeeklyHours(),
      exceptions: [],
      blocks: [],
      appointments: [],
      contentionPolicy: "hide_on_request",
      now: utc("2026-09-01T00:00"),
    });
    expect(slots).toEqual([]);
  });

  it("adds dated exception opens and honours closed exceptions over the template", () => {
    const saturday = generateSlots({
      date: "2026-09-19",
      timezone: TZ,
      durationMinutes: 30,
      hoursMode: "both",
      weeklyHours: defaultWeeklyHours(),
      exceptions: [
        {
          date: "2026-09-19",
          kind: "open",
          intervals: [{ start: "10:00", end: "12:00" }],
        },
      ],
      blocks: [],
      appointments: [],
      contentionPolicy: "hide_on_request",
      now: utc("2026-09-01T00:00"),
    });
    expect(saturday.length).toBeGreaterThan(0);
    expect(
      DateTime.fromJSDate(saturday[0], { zone: "utc" }).setZone(TZ).toFormat("HH:mm"),
    ).toBe("10:00");

    const holiday = generateSlots({
      date: "2026-09-21",
      timezone: TZ,
      durationMinutes: 30,
      hoursMode: "both",
      weeklyHours: defaultWeeklyHours(),
      exceptions: [{ date: "2026-09-21", kind: "closed", intervals: [] }],
      blocks: [],
      appointments: [],
      contentionPolicy: "hide_on_request",
      now: utc("2026-09-01T00:00"),
    });
    expect(holiday).toEqual([]);
  });

  it("ignores exceptions when hoursMode is weekly_template only", () => {
    const slots = generateSlots({
      date: "2026-09-19",
      timezone: TZ,
      durationMinutes: 30,
      hoursMode: "weekly_template",
      weeklyHours: defaultWeeklyHours(),
      exceptions: [
        {
          date: "2026-09-19",
          kind: "open",
          intervals: [{ start: "10:00", end: "12:00" }],
        },
      ],
      blocks: [],
      appointments: [],
      contentionPolicy: "hide_on_request",
      now: utc("2026-09-01T00:00"),
    });
    expect(slots).toEqual([]);
  });

  it("requires a contiguous window matching type duration", () => {
    const consult = generateSlots({
      date: "2026-09-21",
      timezone: TZ,
      durationMinutes: 45,
      hoursMode: "weekly_template",
      weeklyHours: defaultWeeklyHours(),
      exceptions: [],
      blocks: [],
      appointments: [],
      contentionPolicy: "hide_on_request",
      now: utc("2026-09-01T00:00"),
    });
    const locals = consult.map((s) =>
      DateTime.fromJSDate(s, { zone: "utc" }).setZone(TZ).toFormat("HH:mm"),
    );
    expect(locals).toContain("12:15");
    expect(locals).not.toContain("12:30");
  });

  it("skips blocked time and past starts", () => {
    const now = utc("2026-09-21T10:05");
    const slots = generateSlots({
      date: "2026-09-21",
      timezone: TZ,
      durationMinutes: 30,
      hoursMode: "weekly_template",
      weeklyHours: defaultWeeklyHours(),
      exceptions: [],
      blocks: [{ start: utc("2026-09-21T11:00"), end: utc("2026-09-21T12:00") }],
      appointments: [],
      contentionPolicy: "hide_on_request",
      now,
    });
    const locals = slots.map((s) =>
      DateTime.fromJSDate(s, { zone: "utc" }).setZone(TZ).toFormat("HH:mm"),
    );
    expect(locals.some((t) => t < "10:05")).toBe(false);
    expect(locals).not.toContain("11:00");
    expect(locals).not.toContain("11:30");
    expect(locals).toContain("10:15");
    expect(locals).toContain("12:00");
  });

  it("merges overlapping open intervals", () => {
    const open = resolveOpenIntervals({
      date: "2026-09-19",
      timezone: TZ,
      hoursMode: "exceptions_enabled",
      weeklyHours: defaultWeeklyHours(),
      exceptions: [
        {
          date: "2026-09-19",
          kind: "open",
          intervals: [
            { start: "09:00", end: "11:00" },
            { start: "10:30", end: "12:00" },
          ],
        },
      ],
    });
    expect(open).toHaveLength(1);
    expect(open[0].start.toFormat("HH:mm")).toBe("09:00");
    expect(open[0].end.toFormat("HH:mm")).toBe("12:00");
  });
});
