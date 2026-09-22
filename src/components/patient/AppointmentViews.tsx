"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, type Appointment, type Settings } from "./api";
import { formatAppointmentWhen } from "./format";
import { patientActions, statusHint, statusLabel } from "./policy";
import { Alert, Button, StatusBadge } from "./ui";

export function AppointmentCard({
  appointment,
  settings,
  compact,
}: {
  appointment: Appointment;
  settings: Settings;
  compact?: boolean;
}) {
  const when = formatAppointmentWhen(appointment, settings.timezone, settings.defaultLocale);
  return (
    <article className="pt-card">
      <div className="pt-row" style={{ justifyContent: "space-between" }}>
        <h2 className="pt-h1" style={{ fontSize: "1.2rem", margin: 0 }}>
          {appointment.typeName}
        </h2>
        <StatusBadge status={appointment.status} label={statusLabel(appointment.status)} />
      </div>
      <p>{when}</p>
      {!compact ? <p className="pt-muted">{statusHint(appointment.status)}</p> : null}
      <p>
        <Link href={`/appointments/${appointment.id}`}>View details</Link>
      </p>
    </article>
  );
}

export function AppointmentDetailView({
  appointment,
  settings,
}: {
  appointment: Appointment;
  settings: Settings;
}) {
  const router = useRouter();
  const actions = useMemo(
    () => patientActions(appointment, settings.cancelPolicy),
    [appointment, settings.cancelPolicy],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/appointments/${encodeURIComponent(appointment.id)}/cancel`, { method: "POST" });
      router.refresh();
      router.replace("/appointments");
    } catch (err) {
      setError(errorMessage(err, "Could not cancel this visit."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-stack">
      {error ? <Alert>{error}</Alert> : null}
      <div className="pt-card pt-stack">
        <div className="pt-row" style={{ justifyContent: "space-between" }}>
          <p className="pt-kicker">{appointment.typeName}</p>
          <StatusBadge status={appointment.status} label={statusLabel(appointment.status)} />
        </div>
        <h1 className="pt-h1">{formatAppointmentWhen(appointment, settings.timezone, settings.defaultLocale)}</h1>
        <p className="pt-muted">{statusHint(appointment.status)}</p>
        <p className="pt-hint">Times shown in {settings.timezone.replace(/_/g, " ")}.</p>
      </div>
      {actions.canCancel || actions.canReschedule ? (
        <div className="pt-card pt-stack">
          <h2 className="pt-h1" style={{ fontSize: "1.2rem" }}>
            Change this visit
          </h2>
          {actions.reason ? <p className="pt-muted">{actions.reason}</p> : null}
          <div className="pt-row">
            {actions.canReschedule ? (
              <Link className="pt-btn pt-btn-primary" href={`/request?reschedule=${appointment.id}&typeId=${appointment.typeId}`}>
                Reschedule
              </Link>
            ) : null}
            {actions.canCancel ? (
              confirmCancel ? (
                <>
                  <Button variant="danger" disabled={busy} onClick={() => void cancel()}>
                    {busy ? "Cancelling…" : "Confirm cancellation"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                    Keep visit
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                  Cancel visit
                </Button>
              )
            ) : null}
          </div>
        </div>
      ) : (
        <p className="pt-muted">{actions.reason}</p>
      )}
      <p>
        <Link href="/appointments">Back to my appointments</Link>
      </p>
    </div>
  );
}
