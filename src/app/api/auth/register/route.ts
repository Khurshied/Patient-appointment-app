import { NextResponse } from "next/server";
import {
  applySessionCookie,
  createSession,
  findUserByIdentifier,
  hashPassword,
  identifierFromKind,
  publicUser,
} from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { issueOtp, maybeDevCode } from "@/lib/otp";
import { getOrCreateSettings } from "@/lib/settings";

export const runtime = "nodejs";

type Body = {
  identifier?: string;
  kind?: "email" | "phone";
  password?: string;
  displayName?: string;
};

export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  if (!body?.identifier || (body.kind !== "email" && body.kind !== "phone")) {
    return jsonError("identifier and kind (email|phone) are required");
  }

  const settings = await getOrCreateSettings();
  const parsed = identifierFromKind(body.identifier, body.kind);
  if (body.kind === "email" && !parsed.email?.includes("@")) {
    return jsonError("Invalid email");
  }
  if (body.kind === "phone" && (parsed.phone?.replace(/\D/g, "").length ?? 0) < 8) {
    return jsonError("Invalid phone");
  }

  const existing = await findUserByIdentifier(parsed.identifier);
  if (existing) {
    return jsonError("Account already exists", 409);
  }

  if (body.password && !settings.authPassword) {
    return jsonError("Password authentication is disabled");
  }
  if (!settings.authPassword && !settings.authOtp) {
    return jsonError("No authentication mode is enabled", 500);
  }
  if (settings.authPassword && !settings.authOtp && !body.password) {
    return jsonError("Password is required");
  }

  const displayName =
    typeof body.displayName === "string" && body.displayName.trim()
      ? body.displayName.trim()
      : body.kind === "email"
        ? parsed.email!.split("@")[0]
        : "Patient";

  const user = await (await import("@/lib/prisma")).prisma.user.create({
    data: {
      email: parsed.email,
      phone: parsed.phone,
      displayName,
      roles: ["patient"],
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
    },
  });

  let needsOtp = false;
  let dev: { devCode?: string } = {};
  if (settings.authOtp && !body.password) {
    needsOtp = true;
    const issued = await issueOtp(parsed.identifier);
    if (!issued.ok) return jsonError(issued.error, issued.status);
    dev = maybeDevCode(issued.code);
  } else if (settings.authOtp && !settings.authPassword) {
    needsOtp = true;
    const issued = await issueOtp(parsed.identifier);
    if (!issued.ok) return jsonError(issued.error, issued.status);
    dev = maybeDevCode(issued.code);
  }

  const payload = {
    ok: true,
    user: publicUser(user),
    needsOtp,
    ...dev,
  };

  if (!needsOtp && (body.password || !settings.authOtp)) {
    const token = await createSession(user.id);
    const res = NextResponse.json(payload);
    return applySessionCookie(res, token);
  }

  if (body.password && settings.authPassword) {
    const token = await createSession(user.id);
    const res = NextResponse.json({ ...payload, needsOtp: false });
    return applySessionCookie(res, token);
  }

  return jsonOk(payload);
}
