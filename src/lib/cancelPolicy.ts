import type { CancelPolicyId } from "./domain";

export function patientMayCancel(
  policy: CancelPolicyId,
  start: Date,
  now: Date,
): boolean {
  if (policy === "staff_only") return false;
  if (policy === "cutoff_24h") {
    return now.getTime() <= start.getTime() - 24 * 60 * 60 * 1000;
  }
  return now.getTime() < start.getTime();
}

export function patientMayReschedule(
  policy: CancelPolicyId,
  start: Date,
  now: Date,
): boolean {
  if (policy === "staff_only" || policy === "cancel_only") return false;
  if (policy === "cutoff_24h") {
    return now.getTime() <= start.getTime() - 24 * 60 * 60 * 1000;
  }
  return now.getTime() < start.getTime();
}

export function cancelWindowReason(
  policy: CancelPolicyId,
  start: Date,
  now: Date,
  action: "cancel" | "reschedule",
): string | null {
  const allowed =
    action === "cancel"
      ? patientMayCancel(policy, start, now)
      : patientMayReschedule(policy, start, now);
  if (allowed) return null;
  if (policy === "staff_only") {
    return "Only staff can cancel or reschedule this appointment";
  }
  if (policy === "cancel_only" && action === "reschedule") {
    return "Patients cannot reschedule; cancel is allowed until start";
  }
  if (policy === "cutoff_24h") {
    return "Changes are only allowed until 24 hours before the appointment";
  }
  return "The appointment has already started";
}
