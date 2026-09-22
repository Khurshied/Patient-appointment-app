import { requireUser } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { rescheduleAppointment } from "@/lib/appointment-actions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const body = await readJson<{ start?: string }>(request);
  if (!body?.start) return jsonError("start is required");
  return rescheduleAppointment(id, auth.user, body.start);
}
