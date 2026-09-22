import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listSlotsForDate } from "@/lib/appointments";
import { getOrCreateSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const typeId = url.searchParams.get("typeId");
  const date = url.searchParams.get("date");
  if (!typeId || !date) return jsonError("typeId and date are required");

  const settings = await getOrCreateSettings();
  const result = await listSlotsForDate({ typeId, date, settings });
  if (result.error) return jsonError(result.error);
  return jsonOk({
    typeId,
    date,
    durationMinutes: result.type!.durationMinutes,
    slots: result.slots.map((start) => ({ start: start.toISOString() })),
  });
}
