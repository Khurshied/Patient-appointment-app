import { prisma } from "@/lib/prisma";
import { isStaff, requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { serializeAppointment } from "@/lib/appointments";
import { getOrCreateSettings } from "@/lib/settings";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: { type: true, patient: true },
  });
  if (!appt) return jsonError("Appointment not found", 404);
  if (!isStaff(auth.user) && appt.patientId !== auth.user.id) {
    return jsonError("Forbidden", 403);
  }
  const settings = await getOrCreateSettings();
  return jsonOk({ appointment: serializeAppointment(appt, auth.user, settings) });
}
