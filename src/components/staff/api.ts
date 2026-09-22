import type {
  Appointment,
  AppointmentType,
  HoursException,
  HoursMode,
  MeResponse,
  PracticeSettings,
  StaffRole,
  StaffUser,
  TimeBlock,
  WeeklyHours,
  WeekdayKey,
} from "./types";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function unwrapList<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(rec[key])) return rec[key] as T[];
    }
  }
  return [];
}

function unwrapObject<T>(data: unknown, keys: string[]): T {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    for (const key of keys) {
      if (rec[key] && typeof rec[key] === "object" && !Array.isArray(rec[key])) {
        return rec[key] as T;
      }
    }
    return data as T;
  }
  return data as T;
}

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (typeof rec.error === "string") return rec.error;
    if (typeof rec.message === "string") return rec.message;
  }
  return fallback;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
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
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    throw new ApiError(
      errorMessage(body, res.statusText || "Request failed"),
      res.status,
      body,
    );
  }
  return body as T;
}

export function normalizeRoles(roles: unknown): StaffRole[] {
  if (!Array.isArray(roles)) return [];
  return roles
    .map((role) => String(role).toLowerCase())
    .filter(
      (role): role is StaffRole =>
        role === "doctor" || role === "admin" || role === "patient",
    );
}

function emptyWeeklyHours(): WeeklyHours {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

export function defaultSettings(
  partial?: Partial<PracticeSettings> & Record<string, unknown>,
): PracticeSettings {
  const authPassword =
    partial?.authPassword ??
    (partial as { authModes?: { password?: boolean } } | undefined)?.authModes
      ?.password ??
    false;
  const authOtp =
    partial?.authOtp ??
    (partial as { authModes?: { otp?: boolean } } | undefined)?.authModes?.otp ??
    true;
  return {
    timezone: String(partial?.timezone ?? ""),
    locales: partial?.locales?.length ? partial.locales : ["en"],
    defaultLocale: String(partial?.defaultLocale ?? "en"),
    authPassword: Boolean(authPassword),
    authOtp: authOtp !== false,
    contentionPolicy: (partial?.contentionPolicy as PracticeSettings["contentionPolicy"]) ??
      "hide_on_request",
    cancelPolicy:
      (partial?.cancelPolicy as PracticeSettings["cancelPolicy"]) ?? "cutoff_24h",
    reminderOffsets: Array.isArray(partial?.reminderOffsets)
      ? partial.reminderOffsets
      : ["24h", "1h"],
    channels: {
      email: true,
      sms: true,
      push: true,
      ...(partial?.channels as PracticeSettings["channels"] | undefined),
      ...((partial as { notificationChannels?: PracticeSettings["channels"] })
        ?.notificationChannels ?? {}),
    },
    hoursMode:
      (partial?.hoursMode as HoursMode) ??
      ((partial as { workingHoursMode?: HoursMode })?.workingHoursMode) ??
      "both",
    weeklyHours: {
      ...emptyWeeklyHours(),
      ...(partial?.weeklyHours ?? {}),
    },
    intake: Array.isArray(partial?.intake)
      ? partial.intake
      : [
          {
            id: "displayName",
            label: "Display name",
            kind: "text",
            requirement: "required",
          },
          {
            id: "dob",
            label: "Date of birth",
            kind: "date",
            requirement: "off",
          },
        ],
    completeMode:
      (partial?.completeMode as PracticeSettings["completeMode"]) ?? "optional",
  };
}

function normalizeUser(raw: unknown): StaffUser | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = String(rec.id ?? rec.userId ?? "");
  if (!id) return null;
  return {
    id,
    displayName: String(rec.displayName ?? rec.name ?? "Staff"),
    email: (rec.email as string | null) ?? null,
    phone: (rec.phone as string | null) ?? null,
    roles: normalizeRoles(rec.roles ?? rec.role),
    disabled: Boolean(rec.disabled),
  };
}

function normalizeAppointment(raw: unknown): Appointment | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const id = String(rec.id ?? "");
  if (!id) return null;
  const type =
    rec.type && typeof rec.type === "object"
      ? (rec.type as Appointment["type"])
      : null;
  const duration =
    Number(rec.durationMinutes ?? rec.duration ?? type?.durationMinutes ?? 30) ||
    30;
  const start = String(rec.start ?? rec.startsAt ?? rec.startAt ?? "");
  const end =
    rec.end || rec.endsAt
      ? String(rec.end ?? rec.endsAt)
      : start
        ? new Date(new Date(start).getTime() + duration * 60_000).toISOString()
        : undefined;
  const status = String(rec.status ?? "requested")
    .toLowerCase()
    .replace("noshow", "no_show") as Appointment["status"];
  const patientRaw = rec.patient ?? rec.user;
  const patient =
    patientRaw && typeof patientRaw === "object"
      ? {
          id: String((patientRaw as Record<string, unknown>).id ?? ""),
          displayName: String(
            (patientRaw as Record<string, unknown>).displayName ??
              (patientRaw as Record<string, unknown>).name ??
              "Patient",
          ),
          email: ((patientRaw as Record<string, unknown>).email as string) ?? null,
          phone:
            ((patientRaw as Record<string, unknown>).phone as string) ?? null,
        }
      : null;
  const intake =
    (rec.intakeAnswers as Record<string, unknown>) ??
    (rec.intake as Record<string, unknown>) ??
    null;
  return {
    id,
    status,
    start,
    end,
    durationMinutes: duration,
    type,
    typeName: String(rec.typeName ?? type?.name ?? "Visit"),
    patient,
    intake,
    note: (rec.note as string) ?? (rec.reason as string) ?? null,
    needsCloseOut: Boolean(rec.needsCloseOut),
    updatedAt: rec.updatedAt ? String(rec.updatedAt) : undefined,
  };
}

export async function fetchMe(): Promise<MeResponse> {
  const data = await api<unknown>("/api/me");
  const rec = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  return { user: normalizeUser(rec.user ?? rec) };
}

export async function logout() {
  await api("/api/auth/logout", { method: "POST" });
}

export async function fetchSettings(): Promise<PracticeSettings> {
  const data = await api<unknown>("/api/settings");
  const rec = unwrapObject<Partial<PracticeSettings>>(data, ["settings"]);
  return defaultSettings(rec);
}

export async function patchSettings(
  patch: Record<string, unknown>,
): Promise<PracticeSettings> {
  const data = await api<unknown>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const rec = unwrapObject<Partial<PracticeSettings>>(data, ["settings"]);
  return defaultSettings(rec);
}

export async function fetchAppointments(params?: {
  status?: string;
  from?: string;
  to?: string;
  closeOut?: boolean;
}): Promise<Appointment[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.closeOut) query.set("closeOut", "1");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const data = await api<unknown>(`/api/appointments${suffix}`);
  return unwrapList(data, ["appointments", "items", "data"])
    .map(normalizeAppointment)
    .filter((row): row is Appointment => Boolean(row));
}

export async function fetchAppointment(id: string): Promise<Appointment> {
  const data = await api<unknown>(`/api/appointments/${id}`);
  const raw = unwrapObject(data, ["appointment"]);
  const row = normalizeAppointment(raw);
  if (!row) throw new Error("Appointment not found");
  return row;
}

export async function appointmentAction(
  id: string,
  action: "confirm" | "decline" | "cancel" | "complete" | "no-show",
  body?: Record<string, unknown>,
): Promise<Appointment> {
  const data = await api<unknown>(`/api/appointments/${id}/${action}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = unwrapObject(data, ["appointment"]);
  const row = normalizeAppointment(raw);
  if (!row) return fetchAppointment(id);
  return row;
}

export async function fetchTypes(): Promise<AppointmentType[]> {
  const data = await api<unknown>("/api/types");
  return unwrapList<AppointmentType>(data, ["types", "appointmentTypes", "items"]);
}

export async function createType(
  input: Pick<AppointmentType, "name" | "durationMinutes" | "active">,
) {
  return api("/api/types", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateType(id: string, input: Partial<AppointmentType>) {
  return api(`/api/types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteType(id: string) {
  return api(`/api/types/${id}`, { method: "DELETE" });
}

export async function fetchHours(): Promise<{
  hoursMode?: HoursMode;
  weeklyHours: WeeklyHours;
}> {
  const data = await api<unknown>("/api/hours");
  const rec = unwrapObject<Record<string, unknown>>(data, ["hours"]);
  return {
    hoursMode: (rec.hoursMode as HoursMode | undefined) ?? undefined,
    weeklyHours: {
      ...emptyWeeklyHours(),
      ...((rec.weeklyHours as WeeklyHours) ?? {}),
    },
  };
}

export async function saveHours(input: {
  hoursMode?: HoursMode;
  weeklyHours: WeeklyHours;
}) {
  return api("/api/hours", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function fetchExceptions(): Promise<HoursException[]> {
  const data = await api<unknown>("/api/exceptions");
  return unwrapList<HoursException>(data, ["exceptions", "items"]);
}

export async function createException(
  input: Omit<HoursException, "id"> & { id?: string },
) {
  return api("/api/exceptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteException(id: string) {
  return api(`/api/exceptions/${id}`, { method: "DELETE" });
}

export async function fetchBlocks(): Promise<TimeBlock[]> {
  const data = await api<unknown>("/api/blocks");
  return unwrapList<TimeBlock>(data, ["blocks", "items"]).map((row) => ({
    id: String((row as TimeBlock).id),
    start: String((row as TimeBlock).start),
    end: String((row as TimeBlock).end),
    reason:
      (row as TimeBlock).reason ??
      ((row as { note?: string }).note ?? null),
  }));
}

export async function createBlock(input: {
  start: string;
  end: string;
  reason?: string;
}) {
  return api("/api/blocks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteBlock(id: string) {
  return api(`/api/blocks/${id}`, { method: "DELETE" });
}

export async function fetchUsers(): Promise<StaffUser[]> {
  const data = await api<unknown>("/api/users");
  return unwrapList(data, ["users", "items"])
    .map(normalizeUser)
    .filter((row): row is StaffUser => Boolean(row));
}

export async function createUser(input: {
  identifier: string;
  kind: "email" | "phone";
  displayName: string;
  roles: StaffRole[];
  password?: string;
}) {
  return api("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateUser(
  id: string,
  input: Partial<Pick<StaffUser, "roles" | "disabled" | "displayName">>,
) {
  return api(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function isStaff(user: StaffUser | null | undefined) {
  if (!user) return false;
  return user.roles.includes("doctor") || user.roles.includes("admin");
}

export function isAdmin(user: StaffUser | null | undefined) {
  return Boolean(user?.roles.includes("admin"));
}

export function appointmentEnd(row: Appointment) {
  if (row.end) return new Date(row.end);
  return new Date(new Date(row.start).getTime() + row.durationMinutes * 60_000);
}

export function needsCloseOut(
  row: Appointment,
  settings: PracticeSettings,
  now = new Date(),
) {
  if (row.needsCloseOut) return true;
  if (settings.completeMode !== "required") return false;
  if (row.status !== "confirmed") return false;
  const end = appointmentEnd(row);
  const tz = settings.timezone || undefined;
  const visitDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(end);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return today > visitDay;
}

export function weekdayLabel(key: WeekdayKey) {
  const labels: Record<WeekdayKey, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };
  return labels[key];
}
