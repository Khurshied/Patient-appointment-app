import type { Appointment, User } from "@prisma/client";
import { prisma } from "./prisma";
import type { NotificationChannels, SettingsJson } from "./settings";

export type NotifyEvent =
  | "request_submitted"
  | "request_confirmed"
  | "request_declined"
  | "cancelled"
  | "reschedule_requested"
  | "reminder";

function channelsFor(user: Pick<User, "email" | "phone">, enabled: NotificationChannels) {
  const out: Array<"email" | "sms" | "push"> = [];
  if (enabled.email && user.email) out.push("email");
  if (enabled.sms && user.phone) out.push("sms");
  if (enabled.push) out.push("push");
  if (out.length === 0) out.push("email");
  return out;
}

export async function logNotifications(args: {
  event: NotifyEvent;
  appointment?: Pick<Appointment, "id"> | null;
  recipients: Array<Pick<User, "id" | "email" | "phone">>;
  settings: SettingsJson;
  detail?: string;
}) {
  const rows = [];
  for (const recipient of args.recipients) {
    for (const channel of channelsFor(recipient, args.settings.channels)) {
      rows.push({
        userId: recipient.id,
        appointmentId: args.appointment?.id ?? null,
        event: args.event,
        channel,
        status: "logged",
        detail: args.detail ?? `[stub] ${args.event} via ${channel} (no vendor send)`,
      });
    }
  }
  if (rows.length > 0) {
    await prisma.notificationLog.createMany({ data: rows });
  }
}
