import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, publicUser, requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return jsonError("User not found", 404);
  const body = await readJson<{
    displayName?: string;
    roles?: Role[];
    disabled?: boolean;
    password?: string;
    dob?: string | null;
  }>(request);
  if (!body) return jsonError("Invalid JSON");
  if (body.disabled === true && id === auth.user.id) {
    return jsonError("You cannot disable your own account");
  }
  if (body.roles) {
    const allowed: Role[] = ["patient", "doctor", "admin"];
    if (body.roles.some((r) => !allowed.includes(r))) {
      return jsonError("Invalid roles");
    }
  }
  const user = await prisma.user.update({
    where: { id },
    data: {
      displayName: body.displayName?.trim() || undefined,
      roles: body.roles,
      disabled: body.disabled,
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
      dob:
        body.dob === undefined
          ? undefined
          : body.dob
            ? new Date(body.dob)
            : null,
    },
  });
  return jsonOk({ user: publicUser(user) });
}
