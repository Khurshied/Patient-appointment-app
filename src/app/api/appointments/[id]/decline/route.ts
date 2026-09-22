import { requireUser } from "@/lib/auth";
import { declineAppointment } from "@/lib/appointment-actions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  return declineAppointment(id, auth.user);
}
