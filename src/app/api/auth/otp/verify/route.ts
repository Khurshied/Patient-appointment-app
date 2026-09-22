import { NextResponse } from "next/server";
import {
  applySessionCookie,
  createSession,
  findUserByIdentifier,
  identifierFromKind,
  looksLikeEmail,
  publicUser,
} from "@/lib/auth";
import { jsonError, readJson } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { getOrCreateSettings } from "@/lib/settings";

export const runtime = "nodejs";

type Body = { identifier?: string; code?: string };

export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  if (!body?.identifier?.trim() || !body?.code?.trim()) {
    return jsonError("identifier and code are required");
  }
  const settings = await getOrCreateSettings();
  if (!settings.authOtp) return jsonError("OTP authentication is disabled");

  const kind = looksLikeEmail(body.identifier) ? "email" : "phone";
  const parsed = identifierFromKind(body.identifier, kind);
  const ok = await verifyOtp(parsed.identifier, body.code);
  if (!ok) return jsonError("Invalid or expired code", 401);

  const user = await findUserByIdentifier(parsed.identifier);
  if (!user || user.disabled) return jsonError("Unauthorized", 401);

  const token = await createSession(user.id);
  const res = NextResponse.json({ ok: true, user: publicUser(user) });
  return applySessionCookie(res, token);
}
