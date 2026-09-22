"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAppointments, needsCloseOut } from "./api";
import { formatDateTime } from "./format";
import { useStaff } from "./StaffShell";
import type { Appointment } from "./types";
import { Banner, Button, EmptyState, StatusPill } from "./ui";

export function CloseOutList() {
  const { settings } = useStaff();
  const [rows, setRows] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const closeOut = await fetchAppointments({ closeOut: true });
      const fallback =
        closeOut.length > 0
          ? closeOut
          : (await fetchAppointments({ status: "confirmed" })).filter((row) =>
              needsCloseOut(row, settings),
            );
      setRows(fallback);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load close-out list");
    } finally {
      setLoaded(true);
    }
  }, [settings]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) {
    return (
      <section>
        <h1>Needs close-out</h1>
        <p className="staff-muted">Loading…</p>
      </section>
    );
  }

  if (settings.completeMode !== "required" && rows.length === 0) {
    return (
      <section>
        <h1>Needs close-out</h1>
        <Banner>
          Complete / no-show is currently optional. This nag list only appears when the
          practice requires a close-out by end of day.
        </Banner>
      </section>
    );
  }

  return (
    <section>
      <div className="staff-page-head">
        <div>
          <h1>Needs close-out</h1>
          <p>
            Confirmed visits past the local end-of-day deadline that still need completed or
            no-show.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {rows.length === 0 ? (
        <EmptyState title="All caught up" body="No overdue visits need a close-out mark." />
      ) : (
        rows.map((row) => (
          <article key={row.id} className="staff-card">
            <div className="staff-card-row">
              <div>
                <StatusPill status={row.status} />
                <h2 style={{ margin: "0.35rem 0", fontSize: "1.1rem" }}>
                  {row.patient?.displayName ?? "Patient"}
                </h2>
                <p className="staff-muted">
                  {row.typeName ?? row.type?.name} ·{" "}
                  {formatDateTime(row.start, settings.timezone || undefined)}
                </p>
              </div>
              <Link className="staff-link" href={`/visit/${row.id}`}>
                Close out
              </Link>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
