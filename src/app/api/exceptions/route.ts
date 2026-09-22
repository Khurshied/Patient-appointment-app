import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

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

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const exceptions = await prisma.hourException.findMany({
    orderBy: { date: "asc" },
  });
  return jsonOk({ exceptions: exceptions.map(serializeException) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<{
    date?: string;
    kind?: "open" | "closed";
    intervals?: { start: string; end: string }[];
  }>(request);
  if (!body?.date || (body.kind !== "open" && body.kind !== "closed")) {
    return jsonError("date and kind (open|closed) are required");
  }
  const day = DateTime.fromISO(body.date, { zone: "utc" });
  if (!day.isValid) return jsonError("Invalid date");
  const row = await prisma.hourException.create({
    data: {
      date: day.toJSDate(),
      kind: body.kind,
      intervals: body.intervals ?? [],
    },
  });
  return jsonOk({ exception: serializeException(row) }, { status: 201 });
}
