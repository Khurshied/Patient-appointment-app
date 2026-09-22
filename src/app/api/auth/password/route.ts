import { NextResponse } from "next/server";
import {
  applySessionCookie,
  createSession,
  findUserByIdentifier,
  publicUser,
  verifyPassword,
} from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { getOrCreateSettings } from "@/lib/settings";

export const runtime = "nodejs";

type Body = { identifier?: string; password?: string };

export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  if (!body?.identifier?.trim() || !body?.password) {
    return jsonError("identifier and password are required");
  }
  const settings = await getOrCreateSettings();
  if (!settings.authPassword) {
    return jsonError("Password authentication is disabled");
  }

  const user = await findUserByIdentifier(body.identifier);
  if (!user || user.disabled || !user.passwordHash) {
    return jsonError("Invalid credentials", 401);
  }
  const match = await verifyPassword(body.password, user.passwordHash);
  if (!match) return jsonError("Invalid credentials", 401);

  const token = await createSession(user.id);
  const res = NextResponse.json({ ok: true, user: publicUser(user) });
  return applySessionCookie(res, token);
}
