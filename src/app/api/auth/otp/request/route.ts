import { findUserByIdentifier } from "@/lib/auth";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { issueOtp, maybeDevCode } from "@/lib/otp";
import { getOrCreateSettings } from "@/lib/settings";
import { identifierFromKind, looksLikeEmail } from "@/lib/auth";

export const runtime = "nodejs";

type Body = { identifier?: string };

export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  if (!body?.identifier?.trim()) return jsonError("identifier is required");

  const settings = await getOrCreateSettings();
  if (!settings.authOtp) {
    return jsonError("OTP authentication is disabled");
  }

  const kind = looksLikeEmail(body.identifier) ? "email" : "phone";
  const parsed = identifierFromKind(body.identifier, kind);
  const user = await findUserByIdentifier(parsed.identifier);
  if (!user || user.disabled) {
    return jsonOk({ ok: true });
  }

  const issued = await issueOtp(parsed.identifier);
  if (!issued.ok) return jsonError(issued.error, issued.status);
  return jsonOk({ ok: true, ...maybeDevCode(issued.code) });
}
