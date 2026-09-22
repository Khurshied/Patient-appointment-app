import type { AppointmentStatusId, ContentionPolicyId } from "./domain";
import { addMinutes, intervalsOverlap } from "./time";

export type OccupyingAppointment = {
  start: Date;
  durationMinutes: number;
  status: AppointmentStatusId | string;
};

export function pendingRequestsOccupySlots(
  policy: ContentionPolicyId,
): boolean {
  return (
    policy === "hold_first_request" || policy === "hide_on_request"
  );
}

export function appointmentOccupiesCalendar(
  status: string,
  policy: ContentionPolicyId,
): boolean {
  if (status === "confirmed") return true;
  if (status === "requested") return pendingRequestsOccupySlots(policy);
  return false;
}

export function overlapsWindow(
  start: Date,
  durationMinutes: number,
  otherStart: Date,
  otherDurationMinutes: number,
): boolean {
  return intervalsOverlap(
    start,
    addMinutes(start, durationMinutes),
    otherStart,
    addMinutes(otherStart, otherDurationMinutes),
  );
}

export function isWindowOccupied(args: {
  start: Date;
  durationMinutes: number;
  policy: ContentionPolicyId;
  appointments: OccupyingAppointment[];
  blocks: { start: Date; end: Date }[];
  ignoreAppointmentIds?: Set<string>;
}): boolean {
  const end = addMinutes(args.start, args.durationMinutes);
  for (const block of args.blocks) {
    if (intervalsOverlap(args.start, end, block.start, block.end)) {
      return true;
    }
  }
  for (const appt of args.appointments) {
    if (!appointmentOccupiesCalendar(appt.status, args.policy)) continue;
    if (overlapsWindow(args.start, args.durationMinutes, appt.start, appt.durationMinutes)) {
      return true;
    }
  }
  return false;
}

export function overlappingRequested(
  start: Date,
  durationMinutes: number,
  appointments: OccupyingAppointment[],
): OccupyingAppointment[] {
  return appointments.filter(
    (a) =>
      a.status === "requested" &&
      overlapsWindow(start, durationMinutes, a.start, a.durationMinutes),
  );
}
