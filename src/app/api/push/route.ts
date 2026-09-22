import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const rows = await prisma.pushSubscription.findMany({
    where: { userId: auth.user.id },
  });
  return jsonOk({
    subscriptions: rows.map((r) => ({
      id: r.id,
      endpoint: r.endpoint,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const body = await readJson<{
    endpoint?: string;
    keys?: Record<string, string>;
  }>(request);
  if (!body?.endpoint) return jsonError("endpoint is required");
  const row = await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: { userId: auth.user.id, endpoint: body.endpoint },
    },
    update: { keys: body.keys ?? {} },
    create: {
      userId: auth.user.id,
      endpoint: body.endpoint,
      keys: body.keys ?? {},
    },
  });
  return jsonOk({ subscription: { id: row.id, endpoint: row.endpoint } });
}
