import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { generateSlots } from "./slots";
import {
  appointmentOccupiesCalendar,
  isWindowOccupied,
  pendingRequestsOccupySlots,
} from "./contention";
import { defaultWeeklyHours } from "./domain";

const TZ = "Asia/Kolkata";
const date = "2026-09-21";
const now = DateTime.fromISO("2026-09-01T00:00", { zone: TZ }).toUTC().toJSDate();

function utc(isoLocal: string) {
  return DateTime.fromISO(isoLocal, { zone: TZ }).toUTC().toJSDate();
}

function slots(policy: Parameters<typeof generateSlots>[0]["contentionPolicy"], appointments: Parameters<typeof generateSlots>[0]["appointments"]) {
  return generateSlots({
    date,
    timezone: TZ,
    durationMinutes: 30,
    hoursMode: "weekly_template",
    weeklyHours: defaultWeeklyHours(),
    exceptions: [],
    blocks: [],
    appointments,
    contentionPolicy: policy,
    now,
  });
}

describe("same-slot contention", () => {
  it("treats hold_first_request and hide_on_request as occupying on pending requests", () => {
    expect(pendingRequestsOccupySlots("hold_first_request")).toBe(true);
    expect(pendingRequestsOccupySlots("hide_on_request")).toBe(true);
    expect(pendingRequestsOccupySlots("queue_until_confirm")).toBe(false);
    expect(appointmentOccupiesCalendar("requested", "queue_until_confirm")).toBe(
      false,
    );
    expect(appointmentOccupiesCalendar("confirmed", "queue_until_confirm")).toBe(
      true,
    );
  });

  it("hides overlapping times once a request is persisted (hide_on_request)", () => {
    const result = slots("hide_on_request", [
      {
        start: utc("2026-09-21T10:00"),
        durationMinutes: 30,
        status: "requested",
      },
    ]);
    const locals = result.map((s) =>
      DateTime.fromJSDate(s, { zone: "utc" }).setZone(TZ).toFormat("HH:mm"),
    );
    expect(locals).not.toContain("10:00");
    expect(locals).not.toContain("09:45");
    expect(locals).toContain("09:30");
    expect(locals).toContain("10:30");
  });

  it("holds the first request the same way as hide for occupancy", () => {
    const hidden = slots("hide_on_request", [
      {
        start: utc("2026-09-21T10:00"),
        durationMinutes: 30,
        status: "requested",
      },
    ]).map((s) => s.getTime());
    const held = slots("hold_first_request", [
      {
        start: utc("2026-09-21T10:00"),
        durationMinutes: 30,
        status: "requested",
      },
    ]).map((s) => s.getTime());
    expect(held).toEqual(hidden);
  });

  it("keeps the window visible under queue_until_confirm until a confirm", () => {
    const queued = slots("queue_until_confirm", [
      {
        start: utc("2026-09-21T10:00"),
        durationMinutes: 30,
        status: "requested",
      },
    ]);
    const locals = queued.map((s) =>
      DateTime.fromJSDate(s, { zone: "utc" }).setZone(TZ).toFormat("HH:mm"),
    );
    expect(locals).toContain("10:00");

    const afterConfirm = slots("queue_until_confirm", [
      {
        start: utc("2026-09-21T10:00"),
        durationMinutes: 30,
        status: "confirmed",
      },
    ]);
    const afterLocals = afterConfirm.map((s) =>
      DateTime.fromJSDate(s, { zone: "utc" }).setZone(TZ).toFormat("HH:mm"),
    );
    expect(afterLocals).not.toContain("10:00");
  });

  it("applies overlap across mixed durations (60m hold hides 30m starts)", () => {
    const occupied = isWindowOccupied({
      start: utc("2026-09-21T10:00"),
      durationMinutes: 30,
      policy: "hide_on_request",
      appointments: [
        {
          start: utc("2026-09-21T10:00"),
          durationMinutes: 60,
          status: "requested",
        },
      ],
      blocks: [],
    });
    expect(occupied).toBe(true);
    const later = isWindowOccupied({
      start: utc("2026-09-21T10:30"),
      durationMinutes: 30,
      policy: "hide_on_request",
      appointments: [
        {
          start: utc("2026-09-21T10:00"),
          durationMinutes: 60,
          status: "requested",
        },
      ],
      blocks: [],
    });
    expect(later).toBe(true);
    const after = isWindowOccupied({
      start: utc("2026-09-21T11:00"),
      durationMinutes: 30,
      policy: "hide_on_request",
      appointments: [
        {
          start: utc("2026-09-21T10:00"),
          durationMinutes: 60,
          status: "requested",
        },
      ],
      blocks: [],
    });
    expect(after).toBe(false);
  });

  it("frees the window when a held request is declined or cancelled", () => {
    for (const status of ["declined", "cancelled"] as const) {
      const occupied = isWindowOccupied({
        start: utc("2026-09-21T10:00"),
        durationMinutes: 30,
        policy: "hide_on_request",
        appointments: [
          {
            start: utc("2026-09-21T10:00"),
            durationMinutes: 30,
            status,
          },
        ],
        blocks: [],
      });
      expect(occupied).toBe(false);
    }
  });
});
