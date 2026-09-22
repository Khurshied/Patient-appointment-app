const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function weekdayName(index: number) {
  return WEEKDAYS[index] ?? `Day ${index}`;
}

export function formatDateTime(iso: string, timeZone?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(iso: string, timeZone?: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || undefined,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDayHeading(iso: string, timeZone?: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timeZone || undefined,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function ymdInZone(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function startOfWeek(date: Date, timeZone?: string) {
  const ymd = ymdInZone(date, timeZone);
  const [y, m, d] = ymd.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d);
  const weekday = new Date(asUtc).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(asUtc + mondayOffset * 86400000);
  return start;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

export function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function hourInZone(iso: string, timeZone?: string) {
  const value = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timeZone || undefined,
  }).format(new Date(iso));
  return Number(value.replace(/^24$/, "0"));
}
