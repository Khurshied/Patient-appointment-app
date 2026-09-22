"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { appointmentAction, fetchAppointment, fetchAppointments } from "./api";
import { formatDateTime } from "./format";
import { useStaff } from "./StaffShell";
import type { Appointment } from "./types";
import { Banner, Button, StatusPill } from "./ui";

export function AppointmentDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useStaff();
  const id = String(params?.id ?? "");
  const [row, setRow] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setRow(await fetchAppointment(id));
      setError(null);
    } catch (err) {
      try {
        const list = await fetchAppointments();
        const found = list.find((item) => item.id === id) ?? null;
        setRow(found);
        if (!found) setError("Appointment not found");
      } catch (inner) {
        setError(inner instanceof Error ? inner.message : "Could not load appointment");
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "confirm" | "decline" | "cancel" | "complete" | "no-show") {
    setBusy(true);
    try {
      const updated = await appointmentAction(id, action);
      setRow(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!row) {
    return (
      <section>
        <h1>Appointment</h1>
        {error ? <Banner tone="error">{error}</Banner> : <p className="staff-muted">Loading…</p>}
      </section>
    );
  }

  const intakeEntries = row.intake ? Object.entries(row.intake) : [];

  return (
    <section>
      <div className="staff-page-head">
        <div>
          <h1>{row.patient?.displayName ?? "Appointment"}</h1>
          <p>
            <StatusPill status={row.status} />{" "}
            {formatDateTime(row.start, settings.timezone || undefined)}
          </p>
        </div>
        <Link className="staff-link" href="/calendar">
          Back to calendar
        </Link>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className="staff-card">
        <dl className="staff-dl">
          <dt>Type</dt>
          <dd>
            {row.typeName ?? row.type?.name} ({row.durationMinutes} min)
          </dd>
          <dt>Patient</dt>
          <dd>
            {row.patient?.displayName}
            <div className="staff-muted">
              {row.patient?.email}
              {row.patient?.phone ? ` · ${row.patient.phone}` : ""}
            </div>
          </dd>
          <dt>Status</dt>
          <dd>{row.status.replaceAll("_", " ")}</dd>
          {row.note ? (
            <>
              <dt>Note</dt>
              <dd>{row.note}</dd>
            </>
          ) : null}
        </dl>
      </div>
      {intakeEntries.length > 0 ? (
        <div className="staff-card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Intake</h2>
          <dl className="staff-dl">
            {intakeEntries.map(([key, value]) => (
              <div key={key} style={{ display: "contents" }}>
                <dt>{key}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      <div className="staff-actions" style={{ marginTop: "1rem" }}>
        {row.status === "requested" ? (
          <>
            <Button disabled={busy} onClick={() => void act("confirm")}>
              Confirm
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void act("decline")}>
              Decline
            </Button>
          </>
        ) : null}
        {row.status === "confirmed" ? (
          <>
            <Button disabled={busy} onClick={() => void act("complete")}>
              Mark completed
            </Button>
            <Button variant="warn" disabled={busy} onClick={() => void act("no-show")}>
              No-show
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void act("cancel")}>
              Cancel visit
            </Button>
          </>
        ) : null}
        {row.status === "requested" ? (
          <Button variant="secondary" disabled={busy} onClick={() => void act("cancel")}>
            Withdraw request
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => router.push("/inbox")}>
          Inbox
        </Button>
      </div>
      <p className="staff-muted" style={{ marginTop: "1rem" }}>
        Staff can cancel independently of the patient-facing cancel policy (
        {settings.cancelPolicy.replaceAll("_", " ")}).
      </p>
    </section>
  );
}
