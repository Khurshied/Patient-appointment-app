export type StaffRole = "doctor" | "admin" | "patient";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "no_show";

export type ContentionPolicy =
  | "queue_until_confirm"
  | "hold_first_request"
  | "hide_on_request";

export type CancelPolicy =
  | "until_start"
  | "cutoff_24h"
  | "cancel_only"
  | "staff_only";

export type CompleteMode = "optional" | "required";

export type HoursMode = "weekly_template" | "exceptions_enabled" | "both";

export type IntakeRequirement = "required" | "optional" | "off";

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAY_KEYS: WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];

export type TimeInterval = {
  start: string;
  end: string;
};

export type WeeklyHours = Record<WeekdayKey, TimeInterval[]>;

export type HoursException = {
  id: string;
  date: string;
  kind: "open" | "closed";
  intervals?: TimeInterval[];
  note?: string;
};

export type AppointmentType = {
  id: string;
  name: string;
  durationMinutes: number;
  active: boolean;
};

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

export type PracticeSettings = {
  timezone: string;
  locales: string[];
  defaultLocale: string;
  authPassword: boolean;
  authOtp: boolean;
  contentionPolicy: ContentionPolicy;
  cancelPolicy: CancelPolicy;
  reminderOffsets: string[];
  channels: NotificationChannels;
  hoursMode: HoursMode;
  weeklyHours: WeeklyHours;
  intake: IntakeField[];
  completeMode: CompleteMode;
};

export type StaffUser = {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  roles: StaffRole[];
  disabled?: boolean;
};

export type PatientSummary = {
  id?: string;
  displayName?: string;
  email?: string | null;
  phone?: string | null;
};

export type Appointment = {
  id: string;
  status: AppointmentStatus;
  start: string;
  end?: string;
  durationMinutes: number;
  type?: AppointmentType | null;
  typeName?: string;
  patient?: PatientSummary | null;
  intake?: Record<string, unknown> | null;
  note?: string | null;
  needsCloseOut?: boolean;
  updatedAt?: string;
};

export type TimeBlock = {
  id: string;
  start: string;
  end: string;
  reason?: string | null;
};

export type MeResponse = {
  user: StaffUser | null;
};
