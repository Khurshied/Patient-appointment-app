import type { Appointment, CancelPolicy } from "./api";

export type PatientActions = {
  canCancel: boolean;
  canReschedule: boolean;
  reason: string | null;
};

const OPEN_STATUSES = new Set(["requested", "confirmed"]);

export function patientActions(
  appointment: Appointment,
  policy: CancelPolicy,
  now = new Date(),
): PatientActions {
  if (!OPEN_STATUSES.has(appointment.status)) {
    return { canCancel: false, canReschedule: false, reason: "This visit is no longer open to change." };
  }
  if (policy === "staff_only") {
    return {
      canCancel: false,
      canReschedule: false,
      reason: "Please call the practice if you need to change this visit.",
    };
  }

  const start = new Date(appointment.start);
  if (Number.isNaN(start.getTime())) {
    return { canCancel: false, canReschedule: false, reason: "Visit time is unavailable." };
  }
  if (start.getTime() <= now.getTime()) {
    return { canCancel: false, canReschedule: false, reason: "This visit has already started." };
  }

  if (policy === "cutoff_24h") {
    const cutoff = start.getTime() - 24 * 60 * 60 * 1000;
    if (now.getTime() > cutoff) {
      return {
        canCancel: false,
        canReschedule: false,
        reason: "Changes are only allowed until 24 hours before the visit.",
      };
    }
  }

  if (policy === "cancel_only") {
    return { canCancel: true, canReschedule: false, reason: "Rescheduling is handled by the practice." };
  }

  return { canCancel: true, canReschedule: true, reason: null };
}

export function statusLabel(status: Appointment["status"]) {
  switch (status) {
    case "requested":
      return "Requested";
    case "confirmed":
      return "Confirmed";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "no_show":
      return "Did not attend";
    default:
      return status;
  }
}

export function statusHint(status: Appointment["status"]) {
  switch (status) {
    case "requested":
      return "The practice has received this request and will confirm or decline it.";
    case "confirmed":
      return "Your visit is on the calendar. Please arrive a few minutes early.";
    case "declined":
      return "This time was not confirmed. You can request another slot.";
    case "cancelled":
      return "This visit will not take place.";
    case "completed":
      return "Marked complete by the practice.";
    case "no_show":
      return "The practice recorded that this visit was missed.";
    default:
      return "";
  }
}
