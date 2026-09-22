import { prisma } from "@/lib/prisma";
import { isAdmin, requireAdmin, requireUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  const admin = !auth.error && auth.user ? isAdmin(auth.user) : false;
  const types = await prisma.appointmentType.findMany({
    where: admin ? {} : { active: true },
    orderBy: { name: "asc" },
  });
  return jsonOk({ types });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<{
    name?: string;
    durationMinutes?: number;
    active?: boolean;
  }>(request);
  if (!body?.name?.trim()) return jsonError("name is required");
  const duration = Number(body.durationMinutes);
  if (!Number.isInteger(duration) || duration <= 0) {
    return jsonError("durationMinutes must be a positive integer");
  }
  const type = await prisma.appointmentType.create({
    data: {
      name: body.name.trim(),
      durationMinutes: duration,
      active: body.active ?? true,
    },
  });
  return jsonOk({ type }, { status: 201 });
}
