import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.blockedTime.findUnique({ where: { id } });
  if (!existing) return jsonError("Block not found", 404);
  const body = await readJson<{
    start?: string;
    end?: string;
    reason?: string | null;
  }>(request);
  if (!body) return jsonError("Invalid JSON");
  const start = body.start ? new Date(body.start) : undefined;
  const end = body.end ? new Date(body.end) : undefined;
  if (start && Number.isNaN(start.getTime())) return jsonError("Invalid start");
  if (end && Number.isNaN(end.getTime())) return jsonError("Invalid end");
  const nextStart = start ?? existing.start;
  const nextEnd = end ?? existing.end;
  if (nextEnd <= nextStart) return jsonError("end must be after start");
  const block = await prisma.blockedTime.update({
    where: { id },
    data: {
      start,
      end,
      reason: body.reason === undefined ? undefined : body.reason,
    },
  });
  return jsonOk({
    block: {
      id: block.id,
      start: block.start.toISOString(),
      end: block.end.toISOString(),
      reason: block.reason,
    },
  });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.blockedTime.findUnique({ where: { id } });
  if (!existing) return jsonError("Block not found", 404);
  await prisma.blockedTime.delete({ where: { id } });
  return jsonOk({ ok: true });
}
