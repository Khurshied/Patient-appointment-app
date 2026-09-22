import type { PracticeSettings } from "@prisma/client";
import { prisma } from "./prisma";
import {
  CANCEL_POLICIES,
  COMPLETE_MODES,
  CONTENTION_POLICIES,
  HOURS_MODES,
  defaultChannels,
  defaultIntake,
  defaultWeeklyHours,
  emptyWeeklyHours,
  type CancelPolicyId,
  type CompleteModeId,
  type ContentionPolicyId,
  type HoursModeId,
  type IntakeField,
  type NotificationChannels,
  type WeeklyHours,
} from "./domain";
import { isValidIanaZone } from "./time";

export const SETTINGS_ID = "default";

export type SettingsJson = {
  timezone: string;
  locales: string[];
  defaultLocale: string;
  authPassword: boolean;
  authOtp: boolean;
  contentionPolicy: ContentionPolicyId;
  cancelPolicy: CancelPolicyId;
  reminderOffsets: string[];
  channels: NotificationChannels;
  hoursMode: HoursModeId;
  weeklyHours: WeeklyHours;
  intake: IntakeField[];
  completeMode: CompleteModeId;
};

export function decodeSettings(row: PracticeSettings): SettingsJson {
  return {
    timezone: row.timezone,
    locales: Array.isArray(row.locales) ? (row.locales as string[]) : ["en"],
    defaultLocale: row.defaultLocale,
    authPassword: row.authPassword,
    authOtp: row.authOtp,
    contentionPolicy: row.contentionPolicy,
    cancelPolicy: row.cancelPolicy,
    reminderOffsets: Array.isArray(row.reminderOffsets)
      ? (row.reminderOffsets as string[])
      : ["24h", "1h"],
    channels: {
      ...defaultChannels(),
      ...((row.channels as Partial<NotificationChannels>) ?? {}),
    },
    hoursMode: row.hoursMode,
    weeklyHours: {
      ...emptyWeeklyHours(),
      ...((row.weeklyHours as Partial<WeeklyHours>) ?? {}),
    },
    intake: Array.isArray(row.intake)
      ? (row.intake as IntakeField[])
      : defaultIntake(),
    completeMode: row.completeMode,
  };
}

export function publicSettings(settings: SettingsJson) {
  return {
    timezone: settings.timezone,
    locales: settings.locales,
    defaultLocale: settings.defaultLocale,
    authPassword: settings.authPassword,
    authOtp: settings.authOtp,
    cancelPolicy: settings.cancelPolicy,
    intake: settings.intake,
    hoursMode: settings.hoursMode,
  };
}

export async function getOrCreateSettings(): Promise<SettingsJson> {
  const existing = await prisma.practiceSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) return decodeSettings(existing);

  const created = await prisma.practiceSettings.create({
    data: {
      id: SETTINGS_ID,
      timezone: "Asia/Kolkata",
      locales: ["en"],
      defaultLocale: "en",
      authPassword: false,
      authOtp: true,
      contentionPolicy: "hide_on_request",
      cancelPolicy: "cutoff_24h",
      reminderOffsets: ["24h", "1h"],
      channels: defaultChannels(),
      hoursMode: "both",
      weeklyHours: defaultWeeklyHours(),
      intake: defaultIntake(),
      completeMode: "optional",
    },
  });
  return decodeSettings(created);
}

export type SettingsPatch = Partial<{
  timezone: string;
  locales: string[];
  defaultLocale: string;
  authPassword: boolean;
  authOtp: boolean;
  contentionPolicy: ContentionPolicyId;
  cancelPolicy: CancelPolicyId;
  reminderOffsets: string[];
  channels: NotificationChannels;
  hoursMode: HoursModeId;
  weeklyHours: WeeklyHours;
  intake: IntakeField[];
  completeMode: CompleteModeId;
}>;

export function validateSettingsPatch(
  patch: SettingsPatch,
  current: SettingsJson,
): string | null {
  if (patch.timezone && !isValidIanaZone(patch.timezone)) {
    return "Invalid timezone";
  }
  if (patch.locales && (!Array.isArray(patch.locales) || patch.locales.length === 0)) {
    return "At least one locale is required";
  }
  if (patch.defaultLocale) {
    const locales = patch.locales ?? current.locales;
    if (!locales.includes(patch.defaultLocale)) {
      return "defaultLocale must be in locales";
    }
  }
  const authPassword = patch.authPassword ?? current.authPassword;
  const authOtp = patch.authOtp ?? current.authOtp;
  if (!authPassword && !authOtp) {
    return "At least one auth mode (password or otp) must be enabled";
  }
  if (
    patch.contentionPolicy &&
    !CONTENTION_POLICIES.includes(patch.contentionPolicy)
  ) {
    return "Invalid contentionPolicy";
  }
  if (patch.cancelPolicy && !CANCEL_POLICIES.includes(patch.cancelPolicy)) {
    return "Invalid cancelPolicy";
  }
  if (patch.hoursMode && !HOURS_MODES.includes(patch.hoursMode)) {
    return "Invalid hoursMode";
  }
  if (patch.completeMode && !COMPLETE_MODES.includes(patch.completeMode)) {
    return "Invalid completeMode";
  }
  if (patch.reminderOffsets && !Array.isArray(patch.reminderOffsets)) {
    return "reminderOffsets must be an array";
  }
  return null;
}

export async function patchSettings(patch: SettingsPatch): Promise<SettingsJson> {
  const current = await getOrCreateSettings();
  const error = validateSettingsPatch(patch, current);
  if (error) {
    throw Object.assign(new Error(error), { status: 400 });
  }
  const nextLocales = patch.locales ?? current.locales;
  const nextDefault = patch.defaultLocale ?? current.defaultLocale;
  const updated = await prisma.practiceSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      timezone: patch.timezone ?? current.timezone,
      locales: nextLocales,
      defaultLocale: nextLocales.includes(nextDefault)
        ? nextDefault
        : nextLocales[0],
      authPassword: patch.authPassword ?? current.authPassword,
      authOtp: patch.authOtp ?? current.authOtp,
      contentionPolicy: patch.contentionPolicy ?? current.contentionPolicy,
      cancelPolicy: patch.cancelPolicy ?? current.cancelPolicy,
      reminderOffsets: patch.reminderOffsets ?? current.reminderOffsets,
      channels: patch.channels ?? current.channels,
      hoursMode: patch.hoursMode ?? current.hoursMode,
      weeklyHours: patch.weeklyHours ?? current.weeklyHours,
      intake: patch.intake ?? current.intake,
      completeMode: patch.completeMode ?? current.completeMode,
    },
  });
  return decodeSettings(updated);
}
