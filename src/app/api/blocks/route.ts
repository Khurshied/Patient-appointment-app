import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const blocks = await prisma.blockedTime.findMany({
    orderBy: { start: "asc" },
  });
  return jsonOk({
    blocks: blocks.map((b) => ({
      id: b.id,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      reason: b.reason,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if (auth.error) return auth.error;
  const body = await readJson<{
    start?: string;
    end?: string;
    reason?: string;
  }>(request);
  if (!body?.start || !body?.end) return jsonError("start and end are required");
  const start = new Date(body.start);
  const end = new Date(body.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return jsonError("Invalid start/end");
  }
  const block = await prisma.blockedTime.create({
    data: { start, end, reason: body.reason?.trim() || null },
  });
  return jsonOk(
    {
      block: {
        id: block.id,
        start: block.start.toISOString(),
        end: block.end.toISOString(),
        reason: block.reason,
      },
    },
    { status: 201 },
  );
}
