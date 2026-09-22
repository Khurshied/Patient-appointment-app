import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { isStaff, type AuthUser } from "./auth";
import { cancelWindowReason, patientMayCancel, patientMayReschedule } from "./cancelPolicy";
import {
  assertSlotAvailable,
  serializeAppointment,
  staffRecipients,
  type AppointmentWithType,
} from "./appointments";
import { logNotifications } from "./notifications";
import { getOrCreateSettings } from "./settings";
import { jsonError, jsonOk } from "./http";

const include = { type: true, patient: true } as const;

async function loadAppt(id: string) {
  return prisma.appointment.findUnique({ where: { id }, include });
}

function notFound() {
  return jsonError("Appointment not found", 404);
}

function forbid() {
  return jsonError("Forbidden", 403);
}

export async function confirmAppointment(id: string, actor: AuthUser) {
  if (!isStaff(actor)) return forbid();
  const settings = await getOrCreateSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id },
        include,
      });
      if (!appt) return { error: "not_found" as const };
      if (appt.status !== "requested") {
        return { error: "invalid_state" as const, appt };
      }
      const overlap = await tx.appointment.findMany({
        where: {
          status: { in: ["requested", "confirmed"] },
          id: { not: appt.id },
        },
      });
      const windowOverlap = (a: { start: Date; durationMinutes: number }) => {
        const aEnd = a.start.getTime() + a.durationMinutes * 60_000;
        const bEnd = appt.start.getTime() + appt.durationMinutes * 60_000;
        return appt.start.getTime() < aEnd && a.start.getTime() < bEnd;
      };
      const confirmedBlock = overlap.find(
        (a) => a.status === "confirmed" && windowOverlap(a),
      );
      if (confirmedBlock) {
        return { error: "occupied" as const, appt };
      }

      const updated = await tx.appointment.update({
        where: { id: appt.id },
        data: { status: "confirmed", lastChangedById: actor.id },
        include,
      });

      let autoDeclined: AppointmentWithType[] = [];
      if (settings.contentionPolicy === "queue_until_confirm") {
        const pending = overlap.filter(
          (a) => a.status === "requested" && windowOverlap(a),
        );
        if (pending.length > 0) {
          await tx.appointment.updateMany({
            where: { id: { in: pending.map((p) => p.id) } },
            data: { status: "declined", lastChangedById: actor.id },
          });
          autoDeclined = await tx.appointment.findMany({
            where: { id: { in: pending.map((p) => p.id) } },
            include,
          });
        }
      }

      return { error: null, appt: updated, autoDeclined };
    });

    if (result.error === "not_found") return notFound();
    if (result.error === "invalid_state") {
      return jsonError("Only requested appointments can be confirmed", 409);
    }
    if (result.error === "occupied") {
      return jsonError("Slot is already confirmed for another visit", 409);
    }

    await logNotifications({
      event: "request_confirmed",
      appointment: result.appt!,
      recipients: [result.appt!.patient],
      settings,
    });
    for (const declined of result.autoDeclined ?? []) {
      await logNotifications({
        event: "request_declined",
        appointment: declined,
        recipients: [declined.patient],
        settings,
        detail: "Auto-declined after another overlapping request was confirmed",
      });
    }

    return jsonOk({
      appointment: serializeAppointment(result.appt!, actor, settings),
      autoDeclinedIds: (result.autoDeclined ?? []).map((a) => a.id),
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError("Could not confirm appointment", 409);
    }
    throw err;
  }
}

export async function declineAppointment(id: string, actor: AuthUser) {
  if (!isStaff(actor)) return forbid();
  const appt = await loadAppt(id);
  if (!appt) return notFound();
  if (appt.status !== "requested") {
    return jsonError("Only requested appointments can be declined", 409);
  }
  const settings = await getOrCreateSettings();
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "declined", lastChangedById: actor.id },
    include,
  });
  await logNotifications({
    event: "request_declined",
    appointment: updated,
    recipients: [updated.patient],
    settings,
  });
  return jsonOk({ appointment: serializeAppointment(updated, actor, settings) });
}

export async function cancelAppointment(id: string, actor: AuthUser) {
  const appt = await loadAppt(id);
  if (!appt) return notFound();
  const staff = isStaff(actor);
  if (!staff && appt.patientId !== actor.id) return forbid();
  if (!["requested", "confirmed"].includes(appt.status)) {
    return jsonError("This appointment cannot be cancelled", 409);
  }
  const settings = await getOrCreateSettings();
  const now = new Date();
  if (!staff) {
    if (!patientMayCancel(settings.cancelPolicy, appt.start, now)) {
      return jsonError(
        cancelWindowReason(settings.cancelPolicy, appt.start, now, "cancel") ??
          "Cancel not allowed",
        403,
      );
    }
  }
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: "cancelled", lastChangedById: actor.id },
    include,
  });
  const staffUsers = await staffRecipients();
  const recipients = staff
    ? [updated.patient]
    : [updated.patient, ...staffUsers];
  await logNotifications({
    event: "cancelled",
    appointment: updated,
    recipients,
    settings,
    detail: staff ? "Cancelled by staff" : "Cancelled by patient",
  });
  return jsonOk({ appointment: serializeAppointment(updated, actor, settings) });
}

export async function rescheduleAppointment(
  id: string,
  actor: AuthUser,
  startIso: string,
) {
  const appt = await loadAppt(id);
  if (!appt) return notFound();
  const staff = isStaff(actor);
  if (!staff && appt.patientId !== actor.id) return forbid();
  if (!["requested", "confirmed"].includes(appt.status)) {
    return jsonError("This appointment cannot be rescheduled", 409);
  }
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return jsonError("Invalid start");

  const settings = await getOrCreateSettings();
  const now = new Date();
  if (!staff) {
    if (!patientMayReschedule(settings.cancelPolicy, appt.start, now)) {
      return jsonError(
        cancelWindowReason(
          settings.cancelPolicy,
          appt.start,
          now,
          "reschedule",
        ) ?? "Reschedule not allowed",
        403,
      );
    }
  }

  const newStatus = staff && appt.status === "confirmed" ? "confirmed" : "requested";

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const unavailable = await assertSlotAvailable({
        start,
        durationMinutes: appt.durationMinutes,
        settings,
        ignoreAppointmentId: appt.id,
        db: tx,
      });
      if (unavailable) {
        throw Object.assign(new Error(unavailable), { status: 409 });
      }
      await tx.appointment.update({
        where: { id: appt.id },
        data: { status: "cancelled", lastChangedById: actor.id },
      });
      return tx.appointment.create({
        data: {
          patientId: appt.patientId,
          typeId: appt.typeId,
          start,
          durationMinutes: appt.durationMinutes,
          status: newStatus,
          intakeAnswers: appt.intakeAnswers ?? undefined,
          lastChangedById: actor.id,
        },
        include,
      });
    });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      return jsonError(
        err instanceof Error ? err.message : "Slot no longer available",
        Number((err as { status: number }).status) || 409,
      );
    }
    throw err;
  }

  if (newStatus === "requested") {
    const staffUsers = await staffRecipients();
    await logNotifications({
      event: "reschedule_requested",
      appointment: created,
      recipients: staffUsers,
      settings,
    });
    await logNotifications({
      event: "request_submitted",
      appointment: created,
      recipients: [created.patient],
      settings,
    });
  } else {
    await logNotifications({
      event: "request_confirmed",
      appointment: created,
      recipients: [created.patient],
      settings,
      detail: "Staff rescheduled onto a confirmed slot",
    });
  }

  return jsonOk({
    appointment: serializeAppointment(created, actor, settings),
    cancelledId: appt.id,
  });
}

export async function completeAppointment(
  id: string,
  actor: AuthUser,
  as: "completed" | "no_show",
) {
  if (!isStaff(actor)) return forbid();
  const appt = await loadAppt(id);
  if (!appt) return notFound();
  if (appt.status !== "confirmed") {
    return jsonError("Only confirmed visits can be closed out", 409);
  }
  const settings = await getOrCreateSettings();
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: as, lastChangedById: actor.id },
    include,
  });
  return jsonOk({ appointment: serializeAppointment(updated, actor, settings) });
}
