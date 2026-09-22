import type { Appointment } from "./api";

export function ymdInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatDay(iso: string, timeZone: string, locale = "en") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatTime(iso: string, timeZone: string, locale = "en") {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatRange(startIso: string, durationMinutes: number, timeZone: string, locale = "en") {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return `${formatTime(start.toISOString(), timeZone, locale)} – ${formatTime(end.toISOString(), timeZone, locale)}`;
}

export function formatAppointmentWhen(apt: Appointment, timeZone: string, locale = "en") {
  return `${formatDay(apt.start, timeZone, locale)} · ${formatRange(apt.start, apt.durationMinutes, timeZone, locale)}`;
}

export function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function identifierKind(value: string): "email" | "phone" {
  return value.includes("@") ? "email" : "phone";
}

export function looksLikeIdentifier(value: string) {
  const v = value.trim();
  if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const digits = v.replace(/\D/g, "");
  return digits.length >= 8;
}
