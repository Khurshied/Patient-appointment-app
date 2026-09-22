export const WEEKDAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type TimeInterval = { start: string; end: string };

export type WeeklyHours = Record<WeekdayKey, TimeInterval[]>;

export type IntakeRequirement = "required" | "optional" | "off";

export type IntakeField = {
  id: string;
  label: string;
  kind: "text" | "date";
  requirement: IntakeRequirement;
};

export type NotificationChannels = {
  email: boolean;
  sms: boolean;
  push: boolean;
};

export const CONTENTION_POLICIES = [
  "queue_until_confirm",
  "hold_first_request",
  "hide_on_request",
] as const;
export type ContentionPolicyId = (typeof CONTENTION_POLICIES)[number];

export const CANCEL_POLICIES = [
  "until_start",
  "cutoff_24h",
  "cancel_only",
  "staff_only",
] as const;
export type CancelPolicyId = (typeof CANCEL_POLICIES)[number];

export const HOURS_MODES = [
  "weekly_template",
  "exceptions_enabled",
  "both",
] as const;
export type HoursModeId = (typeof HOURS_MODES)[number];

export const COMPLETE_MODES = ["optional", "required"] as const;
export type CompleteModeId = (typeof COMPLETE_MODES)[number];

export const APPOINTMENT_STATUSES = [
  "requested",
  "confirmed",
  "declined",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type AppointmentStatusId = (typeof APPOINTMENT_STATUSES)[number];

export const SLOT_STEP_MINUTES = 15;

export function emptyWeeklyHours(): WeeklyHours {
  return {
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  };
}

export function defaultWeeklyHours(): WeeklyHours {
  const day: TimeInterval[] = [
    { start: "09:00", end: "13:00" },
    { start: "14:00", end: "17:00" },
  ];
  return {
    mon: [...day],
    tue: [...day],
    wed: [...day],
    thu: [...day],
    fri: [...day],
    sat: [],
    sun: [],
  };
}

export function defaultIntake(): IntakeField[] {
  return [
    {
      id: "displayName",
      label: "Display name",
      kind: "text",
      requirement: "required",
    },
    { id: "dob", label: "Date of birth", kind: "date", requirement: "off" },
  ];
}

export function defaultChannels(): NotificationChannels {
  return { email: true, sms: true, push: true };
}
