import { requireAdmin, requireStaff } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { getOrCreateSettings, patchSettings } from "@/lib/settings";
import type { WeeklyHours } from "@/lib/domain";
import { WEEKDAY_KEYS } from "@/lib/domain";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const settings = await getOrCreateSettings();
  return jsonOk({
    hoursMode: settings.hoursMode,
    weeklyHours: settings.weeklyHours,
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<{ weeklyHours?: WeeklyHours; hoursMode?: string }>(
    request,
  );
  if (!body?.weeklyHours) return jsonError("weeklyHours is required");
  for (const key of WEEKDAY_KEYS) {
    if (!Array.isArray(body.weeklyHours[key])) {
      return jsonError(`weeklyHours.${key} must be an array`);
    }
  }
  const settings = await patchSettings({
    weeklyHours: body.weeklyHours,
    hoursMode: body.hoursMode as never,
  });
  return jsonOk({
    hoursMode: settings.hoursMode,
    weeklyHours: settings.weeklyHours,
  });
}

export async function PATCH(request: Request) {
  return PUT(request);
}
