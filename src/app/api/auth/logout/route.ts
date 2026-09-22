import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  const res = NextResponse.json({ ok: true });
  return clearSessionCookie(res);
}
