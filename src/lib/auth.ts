import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role, User } from "@prisma/client";
import { prisma } from "./prisma";
import { jsonError } from "./http";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

export type AuthUser = User;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return plus ? `+${digits}` : digits;
}

export function identifierFromKind(
  identifier: string,
  kind: "email" | "phone",
): { email?: string; phone?: string; identifier: string } {
  if (kind === "email") {
    const email = normalizeEmail(identifier);
    return { email, identifier: email };
  }
  const phone = normalizePhone(identifier);
  return { phone, identifier: phone };
}

export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@");
}

export async function findUserByIdentifier(identifier: string) {
  const raw = identifier.trim();
  if (!raw) return null;
  if (looksLikeEmail(raw)) {
    return prisma.user.findUnique({ where: { email: normalizeEmail(raw) } });
  }
  const phone = normalizePhone(raw);
  const email = normalizeEmail(raw);
  return (
    (await prisma.user.findUnique({ where: { phone } })) ??
    (await prisma.user.findUnique({ where: { email } }))
  );
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    dob: user.dob,
    roles: user.roles,
    disabled: user.disabled,
  };
}

export function isStaff(user: Pick<User, "roles">): boolean {
  return user.roles.includes("doctor") || user.roles.includes("admin");
}

export function isAdmin(user: Pick<User, "roles">): boolean {
  return user.roles.includes("admin");
}

export function isDoctor(user: Pick<User, "roles">): boolean {
  return user.roles.includes("doctor");
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

export function applySessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }
  if (session.user.disabled) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    return { error: jsonError("Unauthorized", 401), user: null as null };
  }
  return { error: null, user };
}

export async function requireStaff() {
  const auth = await requireUser();
  if (auth.error) return auth;
  if (!isStaff(auth.user)) {
    return { error: jsonError("Forbidden", 403), user: null as null };
  }
  return auth;
}

export async function requireAdmin() {
  const auth = await requireUser();
  if (auth.error) return auth;
  if (!isAdmin(auth.user)) {
    return { error: jsonError("Forbidden", 403), user: null as null };
  }
  return auth;
}

export function hasRole(user: Pick<User, "roles">, role: Role): boolean {
  return user.roles.includes(role);
}
