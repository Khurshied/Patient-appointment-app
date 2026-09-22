import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.appointmentType.findUnique({ where: { id } });
  if (!existing) return jsonError("Type not found", 404);
  const body = await readJson<{
    name?: string;
    durationMinutes?: number;
    active?: boolean;
  }>(request);
  if (!body) return jsonError("Invalid JSON");
  if (body.durationMinutes !== undefined) {
    const duration = Number(body.durationMinutes);
    if (!Number.isInteger(duration) || duration <= 0) {
      return jsonError("durationMinutes must be a positive integer");
    }
  }
  const type = await prisma.appointmentType.update({
    where: { id },
    data: {
      name: body.name?.trim() || undefined,
      durationMinutes: body.durationMinutes,
      active: body.active,
    },
  });
  return jsonOk({ type });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.appointmentType.findUnique({ where: { id } });
  if (!existing) return jsonError("Type not found", 404);
  const type = await prisma.appointmentType.update({
    where: { id },
    data: { active: false },
  });
  return jsonOk({ type });
}
