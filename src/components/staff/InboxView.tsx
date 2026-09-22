"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { appointmentAction, fetchAppointments } from "./api";
import { formatDateTime } from "./format";
import { useStaff } from "./StaffShell";
import type { Appointment } from "./types";
import { Banner, Button, EmptyState, StatusPill } from "./ui";

export function InboxView() {
  const { settings } = useStaff();
  const [rows, setRows] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const all = await fetchAppointments({ status: "requested" });
      const pending = all.filter((row) => row.status === "requested");
      setRows(pending);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inbox");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "confirm" | "decline") {
    setBusyId(id);
    try {
      await appointmentAction(id, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <div className="staff-page-head">
        <div>
          <h1>Inbox</h1>
          <p>Pending requests wait here until a doctor or admin confirms or declines.</p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {rows.length === 0 ? (
        <EmptyState
          title="No pending requests"
          body="New patient requests will appear here for confirmation."
        />
      ) : (
        rows.map((row) => (
          <article key={row.id} className="staff-card">
            <div className="staff-card-row">
              <div>
                <StatusPill status={row.status} />
                <h2 style={{ margin: "0.4rem 0 0.2rem", fontSize: "1.15rem" }}>
                  {row.patient?.displayName ?? "Patient"}
                </h2>
                <p className="staff-muted">
                  {row.typeName ?? row.type?.name} · {row.durationMinutes} min
                  <br />
                  {formatDateTime(row.start, settings.timezone || undefined)}
                </p>
                <Link className="staff-link" href={`/visit/${row.id}`}>
                  Open detail
                </Link>
              </div>
              <div className="staff-actions">
                <Button
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, "confirm")}
                >
                  Confirm
                </Button>
                <Button
                  variant="danger"
                  disabled={busyId === row.id}
                  onClick={() => void act(row.id, "decline")}
                >
                  Decline
                </Button>
              </div>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
