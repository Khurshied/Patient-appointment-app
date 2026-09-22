import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { patientMayCancel, patientMayReschedule } from "./cancelPolicy";
import { isWindowOccupied, overlappingRequested } from "./contention";
import { generateSlots } from "./slots";
import { getOrCreateSettings, type SettingsJson } from "./settings";
import { isStaff, type AuthUser } from "./auth";
import type { IntakeField } from "./domain";
import { addMinutes } from "./time";

export type AppointmentWithType = Prisma.AppointmentGetPayload<{
  include: { type: true; patient: true };
}>;

export function validateIntake(
  intake: IntakeField[],
  answers: Record<string, unknown> | null | undefined,
  user: AuthUser,
): string | null {
  const body = answers ?? {};
  for (const field of intake) {
    if (field.requirement !== "required") continue;
    if (field.id === "displayName") {
      const fromAnswers =
        typeof body.displayName === "string" ? body.displayName.trim() : "";
      if (!fromAnswers && !user.displayName.trim()) {
        return "Display name is required";
      }
      continue;
    }
    if (field.id === "dob") {
      if (!body.dob && !user.dob) return "Date of birth is required";
      continue;
    }
    const value = body[field.id];
    if (value === undefined || value === null || value === "") {
      return `${field.label} is required`;
    }
  }
  return null;
}

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function loadOccupancy(
  rangeStart: Date,
  rangeEnd: Date,
  db: DbClient = prisma,
) {
  const [appointments, blocks, exceptions] = await Promise.all([
    db.appointment.findMany({
      where: {
        status: { in: ["requested", "confirmed"] },
        start: { lt: rangeEnd },
      },
    }),
    db.blockedTime.findMany({
      where: {
        start: { lt: rangeEnd },
        end: { gt: rangeStart },
      },
    }),
    db.hourException.findMany(),
  ]);
  return { appointments, blocks, exceptions };
}

export async function listSlotsForDate(args: {
  typeId: string;
  date: string;
  settings: SettingsJson;
}) {
  const type = await prisma.appointmentType.findUnique({
    where: { id: args.typeId },
  });
  if (!type || !type.active) {
    return { error: "Unknown or inactive appointment type" as const, slots: [] };
  }

  const day = DateTime.fromISO(args.date, { zone: args.settings.timezone });
  if (!day.isValid) {
    return { error: "Invalid date" as const, slots: [] };
  }
  const rangeStart = day.startOf("day").toUTC().toJSDate();
  const rangeEnd = day.endOf("day").toUTC().toJSDate();
  const occupancy = await loadOccupancy(rangeStart, rangeEnd);

  const slots = generateSlots({
    date: args.date,
    timezone: args.settings.timezone,
    durationMinutes: type.durationMinutes,
    hoursMode: args.settings.hoursMode,
    weeklyHours: args.settings.weeklyHours,
    exceptions: occupancy.exceptions.map((ex) => ({
      date: DateTime.fromJSDate(ex.date, { zone: "utc" }).toISODate()!,
      kind: ex.kind,
      intervals: Array.isArray(ex.intervals)
        ? (ex.intervals as { start: string; end: string }[])
        : [],
    })),
    blocks: occupancy.blocks,
    appointments: occupancy.appointments,
    contentionPolicy: args.settings.contentionPolicy,
  });

  return { error: null, slots, type };
}

export async function assertSlotAvailable(args: {
  start: Date;
  durationMinutes: number;
  settings: SettingsJson;
  ignoreAppointmentId?: string;
  db?: DbClient;
}): Promise<string | null> {
  const startDt = DateTime.fromJSDate(args.start, { zone: "utc" }).setZone(
    args.settings.timezone,
  );
  const date = startDt.toISODate();
  if (!date) return "Invalid start time";
  if (args.start.getTime() < Date.now()) return "Slot is in the past";

  const rangeStart = startDt.startOf("day").toUTC().toJSDate();
  const rangeEnd = startDt.endOf("day").toUTC().toJSDate();
  const occupancy = await loadOccupancy(rangeStart, rangeEnd, args.db);
  const appointments = occupancy.appointments.filter(
    (a) => a.id !== args.ignoreAppointmentId,
  );

  const open = generateSlots({
    date,
    timezone: args.settings.timezone,
    durationMinutes: args.durationMinutes,
    hoursMode: args.settings.hoursMode,
    weeklyHours: args.settings.weeklyHours,
    exceptions: occupancy.exceptions.map((ex) => ({
      date: DateTime.fromJSDate(ex.date, { zone: "utc" }).toISODate()!,
      kind: ex.kind,
      intervals: Array.isArray(ex.intervals)
        ? (ex.intervals as { start: string; end: string }[])
        : [],
    })),
    blocks: occupancy.blocks,
    appointments,
    contentionPolicy: args.settings.contentionPolicy,
    now: new Date(0),
  });

  const match = open.some((s) => s.getTime() === args.start.getTime());
  if (!match) {
    const occupied = isWindowOccupied({
      start: args.start,
      durationMinutes: args.durationMinutes,
      policy: args.settings.contentionPolicy,
      appointments,
      blocks: occupancy.blocks,
    });
    if (occupied) return "Slot no longer available";
    return "Slot is outside working hours";
  }
  return null;
}

export function needsCloseOut(
  appt: { status: string; start: Date; durationMinutes: number },
  settings: SettingsJson,
  now = new Date(),
): boolean {
  if (settings.completeMode !== "required") return false;
  if (appt.status !== "confirmed") return false;
  const localStart = DateTime.fromJSDate(appt.start, { zone: "utc" }).setZone(
    settings.timezone,
  );
  const deadline = localStart.endOf("day");
  return DateTime.fromJSDate(now, { zone: "utc" }) > deadline;
}

export function serializeAppointment(
  appt: AppointmentWithType,
  viewer: AuthUser,
  settings: SettingsJson,
  now = new Date(),
) {
  const staff = isStaff(viewer);
  const own = appt.patientId === viewer.id;
  const cancelableStatuses = ["requested", "confirmed"];
  const inCancelable = cancelableStatuses.includes(appt.status);
  const canCancel = inCancelable && (staff || (own && patientMayCancel(settings.cancelPolicy, appt.start, now)));
  const canReschedule =
    inCancelable &&
    (staff || (own && patientMayReschedule(settings.cancelPolicy, appt.start, now)));

  return {
    id: appt.id,
    patientId: appt.patientId,
    typeId: appt.typeId,
    start: appt.start.toISOString(),
    end: addMinutes(appt.start, appt.durationMinutes).toISOString(),
    durationMinutes: appt.durationMinutes,
    status: appt.status,
    intakeAnswers: appt.intakeAnswers,
    intake: appt.intakeAnswers,
    typeName: appt.type.name,
    createdAt: appt.createdAt.toISOString(),
    updatedAt: appt.updatedAt.toISOString(),
    type: {
      id: appt.type.id,
      name: appt.type.name,
      durationMinutes: appt.type.durationMinutes,
    },
    patient: staff
      ? {
          id: appt.patient.id,
          displayName: appt.patient.displayName,
          email: appt.patient.email,
          phone: appt.patient.phone,
        }
      : undefined,
    actions: {
      canCancel,
      canReschedule,
      canConfirm: staff && appt.status === "requested",
      canDecline: staff && appt.status === "requested",
      canComplete: staff && appt.status === "confirmed",
      canNoShow: staff && appt.status === "confirmed",
    },
    needsCloseOut: staff ? needsCloseOut(appt, settings, now) : false,
  };
}

export async function staffRecipients() {
  return prisma.user.findMany({
    where: {
      disabled: false,
      roles: { hasSome: ["doctor", "admin"] },
    },
  });
}

export { overlappingRequested, getOrCreateSettings };
