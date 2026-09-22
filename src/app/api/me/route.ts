import { publicUser, requireUser } from "@/lib/auth";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  return jsonOk({ user: publicUser(auth.user) });
}
