"use client";

/**
 * Patient UI API client.
 *
 * Assumptions (backend contracts, with defensive parsing):
 * - Session cookie auth (`credentials: "include"`).
 * - JSON bodies; errors `{ error | message | code }` plus HTTP status.
 * - `/api/me` is `{ user }` or the user object; 401 when signed out.
 * - `/api/settings` is public enough for login (auth flags, types, intake, tz, cancel policy).
 * - Slot `date` query is `YYYY-MM-DD` in the practice timezone.
 * - Appointment `start` is an ISO-8601 instant (UTC).
 * - OTP request may include `devCode` in non-production for QA.
 * - Cancel / reschedule: POST `/api/appointments/:id/cancel` and `.../reschedule`.
 */

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, unknown> | null;
    const nested =
      body && typeof body === "object"
        ? (body.error as Record<string, unknown> | undefined)
        : undefined;
    const fromBody =
      (typeof body?.message === "string" && body.message) ||
      (typeof body?.error === "string" && body.error) ||
      (typeof nested?.message === "string" && nested.message) ||
      (typeof body?.detail === "string" && body.detail);
    if (fromBody) return fromBody;
    if (err.status === 401) return "Please sign in to continue.";
    if (err.status === 403) return "You do not have permission to do that.";
    if (err.status === 404) return "We could not find that.";
    if (err.status === 409) return "That slot is no longer available.";
    if (err.status === 429) return "Too many attempts. Please wait a moment.";
    return err.message || fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const message = errorMessage(new ApiError(res.status, data, res.statusText), res.statusText);
    throw new ApiError(res.status, data, message);
  }

  return data as T;
}

export type AuthKind = "email" | "phone";

export type Me = {
  id: string;
  roles: string[];
  email: string | null;
  phone: string | null;
  identifier: string;
  displayName: string | null;
  dateOfBirth: string | null;
  profile: Record<string, unknown>;
};

export type AppointmentType = {
  id: string;
  name: string;
  durationMinutes: number;
  active: boolean;
};

export type IntakeRequirement = "required" | "optional" | "off";

export type IntakeField = {
  id: string;
  key: string;
  label: string;
  type: "text" | "date" | "tel" | "email" | "textarea";
  requirement: IntakeRequirement;
};

export type CancelPolicy = "until_start" | "cutoff_24h" | "cancel_only" | "staff_only";

export type Settings = {
  practiceName: string;
  timezone: string;
  locales: string[];
  defaultLocale: string;
  auth: { password: boolean; otp: boolean };
  cancelPolicy: CancelPolicy;
  appointmentTypes: AppointmentType[];
  intakeFields: IntakeField[];
};

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "no_show";

export type Appointment = {
  id: string;
  typeId: string;
  typeName: string;
  start: string;
  end: string | null;
  durationMinutes: number;
  status: AppointmentStatus;
  intake: Record<string, unknown> | null;
};

export type Slot = {
  start: string;
  label?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number") return String(v);
  return null;
}

function bool(v: unknown, fallback = false) {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1) return true;
  if (v === "false" || v === 0) return false;
  return fallback;
}

function pick<T = unknown>(obj: Record<string, unknown> | null | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k] as T;
  }
  return undefined;
}

function unwrap(data: unknown, keys: string[]): unknown {
  if (!isRecord(data)) return data;
  for (const k of keys) {
    if (data[k] !== undefined) return data[k];
  }
  return data;
}

export function parseMe(data: unknown): Me | null {
  const raw = unwrap(data, ["user", "me", "data"]);
  if (!isRecord(raw) || (!raw.id && !raw.userId)) return null;
  const rolesRaw = pick<unknown>(raw, ["roles", "role"]);
  const roles = Array.isArray(rolesRaw)
    ? rolesRaw.map(String)
    : rolesRaw
      ? [String(rolesRaw)]
      : [];
  const email = str(pick(raw, ["email", "emailAddress"]));
  const phone = str(pick(raw, ["phone", "mobile", "mobileNumber", "phoneNumber"]));
  const identifier =
    str(pick(raw, ["identifier"])) || email || phone || str(raw.id) || "";
  const profile = isRecord(raw.profile) ? raw.profile : isRecord(raw.intake) ? raw.intake : {};
  return {
    id: String(pick(raw, ["id", "userId"])),
    roles: roles.map((r) => r.toLowerCase()),
    email,
    phone,
    identifier,
    displayName: str(pick(raw, ["displayName", "display_name", "name"])) || str(profile.displayName) || null,
    dateOfBirth:
      str(pick(raw, ["dateOfBirth", "date_of_birth", "dob"])) ||
      str(profile.dateOfBirth) ||
      str(profile.dob) ||
      null,
    profile,
  };
}

function parseAuthFlags(raw: Record<string, unknown>): { password: boolean; otp: boolean } {
  const auth = isRecord(raw.auth) ? raw.auth : isRecord(raw.authModes) ? raw.authModes : raw;
  const modes = pick<unknown>(raw, ["authModes", "auth_modes", "modes"]);
  const modeList = Array.isArray(modes) ? modes.map((m) => String(m).toLowerCase()) : [];
  const passwordVal = pick(auth, ["password", "passwordEnabled", "password_enabled", "authPassword"]);
  const otpVal = pick(auth, ["otp", "otpEnabled", "otp_enabled", "authOtp"]);
  let password = bool(passwordVal);
  let otp = bool(otpVal);
  if (modeList.includes("password")) password = true;
  if (modeList.includes("otp")) otp = true;
  if (modeList.includes("both")) {
    password = true;
    otp = true;
  }
  const single = str(pick(auth, ["mode", "authMode"]));
  if (single === "password") password = true;
  if (single === "otp") otp = true;
  if (single === "both") {
    password = true;
    otp = true;
  }
  if (
    passwordVal === undefined &&
    otpVal === undefined &&
    modeList.length === 0 &&
    !single
  ) {
    otp = true;
  }
  return { password, otp };
}

function parseCancelPolicy(raw: Record<string, unknown>): CancelPolicy {
  const value = String(
    pick(raw, ["cancelPolicy", "cancel_policy", "cancelReschedulePolicy", "cancelReschedule"]) ||
      (isRecord(raw.policies) && pick(raw.policies, ["cancel", "cancelReschedule"])) ||
      "cutoff_24h",
  );
  if (value === "until_start" || value === "cutoff_24h" || value === "cancel_only" || value === "staff_only") {
    return value;
  }
  return "cutoff_24h";
}

function parseTypes(raw: unknown): AppointmentType[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.items)
      ? raw.items
      : [];
  return list
    .filter(isRecord)
    .map((t) => ({
      id: String(pick(t, ["id", "typeId"]) ?? ""),
      name: str(pick(t, ["name", "label", "title"])) || "Visit",
      durationMinutes: Number(pick(t, ["durationMinutes", "duration_minutes", "duration"]) ?? 30),
      active: pick(t, ["active", "isActive"]) === undefined ? true : bool(pick(t, ["active", "isActive"]), true),
    }))
    .filter((t) => t.id);
}

function parseIntake(raw: unknown): IntakeField[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.items)
      ? raw.items
      : [];
  if (list.length === 0) {
    return [
      { id: "displayName", key: "displayName", label: "Your name", type: "text", requirement: "required" },
    ];
  }
  return list
    .filter(isRecord)
    .map((f, i) => {
      const key = str(pick(f, ["id", "key", "name", "field"])) || `field_${i}`;
      const reqRaw = String(pick(f, ["requirement", "required", "status", "mode"]) ?? "").toLowerCase();
      let requirement: IntakeRequirement = "optional";
      if (reqRaw === "required" || reqRaw === "true" || f.required === true) requirement = "required";
      else if (reqRaw === "off" || reqRaw === "disabled" || reqRaw === "false" || f.enabled === false)
        requirement = "off";
      else if (reqRaw === "optional") requirement = "optional";
      const typeRaw = String(pick(f, ["type", "inputType", "kind"]) ?? "text").toLowerCase();
      const type: IntakeField["type"] =
        typeRaw === "date" || typeRaw === "tel" || typeRaw === "email" || typeRaw === "textarea"
          ? typeRaw
          : "text";
      const label =
        str(pick(f, ["label", "name", "title"])) ||
        (key === "displayName" || key === "display_name" ? "Your name" : key === "dateOfBirth" || key === "dob" ? "Date of birth" : key);
      return { id: String(pick(f, ["id"]) ?? key), key, label, type, requirement };
    });
}

export function parseSettings(data: unknown): Settings {
  const raw = (isRecord(data) ? unwrap(data, ["settings", "data", "practice"]) : {}) as Record<
    string,
    unknown
  >;
  const rec = isRecord(raw) ? raw : {};
  const types =
    parseTypes(pick(rec, ["appointmentTypes", "appointment_types", "types", "visitTypes"])) || [];
  return {
    practiceName: str(pick(rec, ["practiceName", "practice_name", "name", "clinicName"])) || "The practice",
    timezone: str(pick(rec, ["timezone", "timeZone", "tz", "ianaTimezone"])) || "UTC",
    locales: Array.isArray(rec.locales) ? rec.locales.map(String) : ["en"],
    defaultLocale: str(pick(rec, ["defaultLocale", "locale"])) || "en",
    auth: parseAuthFlags(rec),
    cancelPolicy: parseCancelPolicy(rec),
    appointmentTypes: types,
    intakeFields: parseIntake(pick(rec, ["intakeFields", "intake_fields", "intake", "intakeSchema"])),
  };
}

export function parseAppointments(data: unknown): Appointment[] {
  const raw = unwrap(data, ["appointments", "items", "data", "results"]);
  const list = Array.isArray(raw) ? raw : [];
  return list.filter(isRecord).map(parseAppointment).filter((a): a is Appointment => Boolean(a));
}

export function parseAppointment(raw: unknown): Appointment | null {
  const rec = isRecord(raw) ? (unwrap(raw, ["appointment", "data"]) as unknown) : raw;
  if (!isRecord(rec) || !pick(rec, ["id"])) return null;
  const type = isRecord(rec.type) ? rec.type : isRecord(rec.appointmentType) ? rec.appointmentType : null;
  const typeId = String(pick(rec, ["typeId", "type_id", "appointmentTypeId"]) ?? pick(type ?? {}, ["id"]) ?? "");
  const typeName =
    str(pick(rec, ["typeName", "type_name"])) || str(pick(type ?? {}, ["name", "label"])) || "Visit";
  const durationMinutes = Number(
    pick(rec, ["durationMinutes", "duration_minutes", "duration"]) ??
      pick(type ?? {}, ["durationMinutes", "duration"]) ??
      30,
  );
  const start = str(pick(rec, ["start", "startAt", "start_at", "startsAt"])) || "";
  const end = str(pick(rec, ["end", "endAt", "end_at", "endsAt"]));
  const statusRaw = String(pick(rec, ["status", "state"]) ?? "requested").toLowerCase().replace("-", "_");
  const status = (
    ["requested", "confirmed", "declined", "cancelled", "canceled", "completed", "no_show", "noshow"].includes(
      statusRaw,
    )
      ? statusRaw.replace("canceled", "cancelled").replace("noshow", "no_show")
      : "requested"
  ) as AppointmentStatus;
  const intake = isRecord(rec.intake)
    ? rec.intake
    : isRecord(rec.intakeAnswers)
      ? rec.intakeAnswers
      : isRecord(rec.answers)
        ? rec.answers
        : null;
  return {
    id: String(rec.id),
    typeId,
    typeName,
    start,
    end,
    durationMinutes,
    status,
    intake,
  };
}

export function parseSlots(data: unknown): Slot[] {
  const raw = unwrap(data, ["slots", "items", "data", "opens", "openSlots"]);
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => {
      if (typeof item === "string") return { start: item };
      if (isRecord(item)) {
        const start = str(pick(item, ["start", "startAt", "start_at", "time", "at"]));
        if (!start) return null;
        return { start, label: str(pick(item, ["label"])) || undefined };
      }
      return null;
    })
    .filter((s): s is Slot => Boolean(s));
}

export function extractDevCode(data: unknown): string | null {
  if (!isRecord(data)) return null;
  return (
    str(pick(data, ["devCode", "dev_code", "debugCode"])) ||
    (isRecord(data.dev) ? str(pick(data.dev, ["code", "otp"])) : null)
  );
}

export function isStaff(me: Me | null) {
  if (!me) return false;
  return me.roles.some((r) => r === "doctor" || r === "admin" || r === "staff");
}

export function isPatient(me: Me | null) {
  if (!me) return false;
  if (me.roles.length === 0) return true;
  return me.roles.includes("patient") || !isStaff(me);
}

export function postLoginPath(me: Me | null) {
  if (isStaff(me)) return "/inbox";
  return "/dashboard";
}

export async function fetchMe(): Promise<Me | null> {
  try {
    const data = await api("/api/me");
    return parseMe(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function fetchSettings(): Promise<Settings> {
  const data = await api("/api/settings");
  const settings = parseSettings(data);
  if (settings.appointmentTypes.length === 0) {
    for (const path of ["/api/appointment-types", "/api/types"]) {
      try {
        const typesData = await api(path);
        const types = parseTypes(unwrap(typesData, ["appointmentTypes", "types", "items", "data"]));
        if (types.length) {
          settings.appointmentTypes = types;
          break;
        }
      } catch {
        // Types may live only on settings, or this path may be staff-only.
      }
    }
  }
  return settings;
}

export async function fetchAppointments(): Promise<Appointment[]> {
  const data = await api("/api/appointments");
  return parseAppointments(data);
}

export async function fetchSlots(typeId: string, date: string): Promise<Slot[]> {
  const params = new URLSearchParams({ typeId, date });
  const data = await api(`/api/slots?${params.toString()}`);
  return parseSlots(data);
}
