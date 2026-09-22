import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  identifierFromKind,
  publicUser,
  requireAdmin,
} from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  return jsonOk({ users: users.map(publicUser) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const body = await readJson<{
    identifier?: string;
    kind?: "email" | "phone";
    displayName?: string;
    roles?: Role[];
    password?: string;
  }>(request);
  if (!body?.identifier || (body.kind !== "email" && body.kind !== "phone")) {
    return jsonError("identifier and kind (email|phone) are required");
  }
  const roles = body.roles?.length ? body.roles : (["patient"] as Role[]);
  const allowed: Role[] = ["patient", "doctor", "admin"];
  if (roles.some((r) => !allowed.includes(r))) return jsonError("Invalid roles");
  const parsed = identifierFromKind(body.identifier, body.kind);
  const user = await prisma.user.create({
    data: {
      email: parsed.email,
      phone: parsed.phone,
      displayName: body.displayName?.trim() || parsed.identifier,
      roles,
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
    },
  });
  return jsonOk({ user: publicUser(user) }, { status: 201 });
}
