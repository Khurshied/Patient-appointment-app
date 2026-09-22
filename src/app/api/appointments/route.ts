import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStaff, requireUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import {
  assertSlotAvailable,
  serializeAppointment,
  staffRecipients,
  validateIntake,
} from "@/lib/appointments";
import { logNotifications } from "@/lib/notifications";
import { getOrCreateSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const settings = await getOrCreateSettings();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const closeOut = url.searchParams.get("closeOut");

  const where: Prisma.AppointmentWhereInput = isStaff(auth.user)
    ? {}
    : { patientId: auth.user.id };

  if (status) {
    where.status = status as Prisma.AppointmentWhereInput["status"];
  }
  if (from || to) {
    where.start = {};
    if (from) where.start.gte = new Date(from);
    if (to) where.start.lte = new Date(to);
  }

  const rows = await prisma.appointment.findMany({
    where,
    include: { type: true, patient: true },
    orderBy: { start: "asc" },
  });
  let appointments = rows.map((row) =>
    serializeAppointment(row, auth.user, settings),
  );
  if (closeOut === "1" || closeOut === "true") {
    appointments = appointments.filter((row) => row.needsCloseOut);
  }
  return jsonOk({ appointments });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const body = await readJson<{
    typeId?: string;
    start?: string;
    intake?: Record<string, unknown>;
  }>(request);
  if (!body?.typeId || !body?.start) {
    return jsonError("typeId and start are required");
  }
  const start = new Date(body.start);
  if (Number.isNaN(start.getTime())) return jsonError("Invalid start");

  const settings = await getOrCreateSettings();
  const type = await prisma.appointmentType.findUnique({
    where: { id: body.typeId },
  });
  if (!type || !type.active) {
    return jsonError("Unknown or inactive appointment type");
  }

  const intakeError = validateIntake(settings.intake, body.intake, auth.user);
  if (intakeError) return jsonError(intakeError);

  const intake = body.intake ?? {};
  if (typeof intake.displayName === "string" && intake.displayName.trim()) {
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { displayName: intake.displayName.trim() },
    });
    auth.user.displayName = intake.displayName.trim();
  }
  if (typeof intake.dob === "string" && intake.dob) {
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { dob: new Date(intake.dob) },
    });
  }

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const unavailable = await assertSlotAvailable({
          start,
          durationMinutes: type.durationMinutes,
          settings,
          db: tx,
        });
        if (unavailable) {
          throw Object.assign(new Error(unavailable), { status: 409 });
        }
        return tx.appointment.create({
          data: {
            patientId: auth.user.id,
            typeId: type.id,
            start,
            durationMinutes: type.durationMinutes,
            status: "requested",
            intakeAnswers: intake,
            lastChangedById: auth.user.id,
          },
          include: { type: true, patient: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const staff = await staffRecipients();
    await logNotifications({
      event: "request_submitted",
      appointment: created,
      recipients: [created.patient, ...staff],
      settings,
    });

    return jsonOk(
      { appointment: serializeAppointment(created, auth.user, settings) },
      { status: 201 },
    );
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      return jsonError(
        err instanceof Error ? err.message : "Slot no longer available",
        Number((err as { status: number }).status) || 409,
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonError("Slot no longer available", 409);
    }
    throw err;
  }
}
