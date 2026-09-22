import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function serializeException(row: {
  id: string;
  date: Date;
  kind: string;
  intervals: unknown;
}) {
  return {
    id: row.id,
    date: DateTime.fromJSDate(row.date, { zone: "utc" }).toISODate(),
    kind: row.kind,
    intervals: row.intervals,
  };
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.hourException.findUnique({ where: { id } });
  if (!existing) return jsonError("Exception not found", 404);
  const body = await readJson<{
    date?: string;
    kind?: "open" | "closed";
    intervals?: { start: string; end: string }[];
  }>(request);
  if (!body) return jsonError("Invalid JSON");
  const date = body.date
    ? DateTime.fromISO(body.date, { zone: "utc" }).toJSDate()
    : undefined;
  const row = await prisma.hourException.update({
    where: { id },
    data: {
      date,
      kind: body.kind,
      intervals: body.intervals,
    },
  });
  return jsonOk({ exception: serializeException(row) });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.hourException.findUnique({ where: { id } });
  if (!existing) return jsonError("Exception not found", 404);
  await prisma.hourException.delete({ where: { id } });
  return jsonOk({ ok: true });
}
