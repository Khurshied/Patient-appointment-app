import { prisma } from "./prisma";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_PER_WINDOW = 5;
const OTP_WINDOW_MS = 15 * 60 * 1000;

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueOtp(identifier: string): Promise<
  | { ok: true; code: string }
  | { ok: false; error: string; status: number }
> {
  const recent = await prisma.otpCode.count({
    where: {
      identifier,
      createdAt: { gt: new Date(Date.now() - OTP_WINDOW_MS) },
    },
  });
  if (recent >= OTP_MAX_PER_WINDOW) {
    return {
      ok: false,
      error: "Too many OTP requests; try again later",
      status: 429,
    };
  }

  const code = randomCode();
  await prisma.otpCode.create({
    data: {
      identifier,
      code,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  console.log(`[otp] identifier=${identifier} code=${code}`);
  return { ok: true, code };
}

export async function verifyOtp(
  identifier: string,
  code: string,
): Promise<boolean> {
  const row = await prisma.otpCode.findFirst({
    where: {
      identifier,
      code: code.trim(),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return false;
  await prisma.otpCode.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return true;
}

export function maybeDevCode(code: string): { devCode?: string } {
  if (process.env.NODE_ENV !== "production") {
    return { devCode: code };
  }
  return {};
}
