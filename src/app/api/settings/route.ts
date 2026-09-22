import { isAdmin, requireUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import {
  getOrCreateSettings,
  patchSettings,
  publicSettings,
  type SettingsPatch,
} from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  const settings = await getOrCreateSettings();
  const auth = await requireUser();
  if (!auth.error && isAdmin(auth.user)) {
    return jsonOk({ settings });
  }
  return jsonOk({ settings: publicSettings(settings) });
}

export async function PATCH(request: Request) {
  const { requireAdmin } = await import("@/lib/auth");
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<SettingsPatch>(request);
  if (!body) return jsonError("Invalid JSON");
  try {
    const settings = await patchSettings(body);
    return jsonOk({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid settings";
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 400;
    return jsonError(message, status);
  }
}
