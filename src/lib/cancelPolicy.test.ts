import { describe, expect, it } from "vitest";
import {
  cancelWindowReason,
  patientMayCancel,
  patientMayReschedule,
} from "./cancelPolicy";

const start = new Date("2026-09-22T10:00:00.000Z");

describe("cancel / reschedule policy", () => {
  it("until_start allows both until the start instant", () => {
    const before = new Date(start.getTime() - 1000);
    const at = start;
    expect(patientMayCancel("until_start", start, before)).toBe(true);
    expect(patientMayReschedule("until_start", start, before)).toBe(true);
    expect(patientMayCancel("until_start", start, at)).toBe(false);
    expect(patientMayReschedule("until_start", start, at)).toBe(false);
  });

  it("cutoff_24h allows both only until 24 hours before start", () => {
    const justInside = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const justOutside = new Date(start.getTime() - 24 * 60 * 60 * 1000 + 1);
    expect(patientMayCancel("cutoff_24h", start, justInside)).toBe(true);
    expect(patientMayReschedule("cutoff_24h", start, justInside)).toBe(true);
    expect(patientMayCancel("cutoff_24h", start, justOutside)).toBe(false);
    expect(patientMayReschedule("cutoff_24h", start, justOutside)).toBe(false);
    expect(cancelWindowReason("cutoff_24h", start, justOutside, "cancel")).toMatch(
      /24 hours/,
    );
  });

  it("cancel_only allows cancel until start but never reschedule", () => {
    const before = new Date(start.getTime() - 60_000);
    expect(patientMayCancel("cancel_only", start, before)).toBe(true);
    expect(patientMayReschedule("cancel_only", start, before)).toBe(false);
    expect(
      cancelWindowReason("cancel_only", start, before, "reschedule"),
    ).toMatch(/cannot reschedule/i);
  });

  it("staff_only blocks patient cancel and reschedule", () => {
    const before = new Date(start.getTime() - 48 * 60 * 60 * 1000);
    expect(patientMayCancel("staff_only", start, before)).toBe(false);
    expect(patientMayReschedule("staff_only", start, before)).toBe(false);
    expect(cancelWindowReason("staff_only", start, before, "cancel")).toMatch(
      /staff/i,
    );
  });
});
