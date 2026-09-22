"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage, fetchAppointments, fetchMe, type Appointment, type Me } from "./api";
import { formatAppointmentWhen } from "./format";
import { useSettings } from "./hooks";
import { statusLabel } from "./policy";
import { Alert, EmptyState, StatusBadge } from "./ui";

export function DashboardHome() {
  const { settings, error: settingsError, loading: settingsLoading } = useSettings();
  const [me, setMe] = useState<Me | null>(null);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [user, list] = await Promise.all([fetchMe(), fetchAppointments()]);
        if (cancelled) return;
        setMe(user);
        setAppointments(list);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming =
    appointments
      ?.filter((a) => a.status === "requested" || a.status === "confirmed")
      .slice()
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()) ?? [];
  const next = upcoming[0];
  const tz = settings?.timezone ?? "UTC";
  const locale = settings?.defaultLocale ?? "en";

  return (
    <div className="pt-stack">
      <div>
        <h1 className="pt-h1">Hello{me?.displayName ? `, ${me.displayName}` : ""}</h1>
        <p className="pt-lede">Request a visit, then wait for the practice to confirm the time.</p>
      </div>
      {error || settingsError ? <Alert>{error || settingsError}</Alert> : null}
      {appointments === null || settingsLoading ? <p className="pt-muted">Loading your visits…</p> : null}
      {next && settings ? (
        <section className="pt-card pt-stack" aria-labelledby="next-visit">
          <p className="pt-kicker">Upcoming</p>
          <h2 id="next-visit" className="pt-h1" style={{ fontSize: "1.45rem" }}>
            {next.typeName}
          </h2>
          <p>{formatAppointmentWhen(next, tz, locale)}</p>
          <StatusBadge status={next.status} label={statusLabel(next.status)} />
          <div className="pt-row">
            <Link className="pt-btn pt-btn-primary" href={`/appointments/${next.id}`}>
              Visit details
            </Link>
            <Link className="pt-btn pt-btn-ghost" href="/appointments">
              All appointments
            </Link>
          </div>
        </section>
      ) : appointments && !next ? (
        <EmptyState title="No upcoming visits">
          <p>When you request a slot, it will appear here until the practice confirms or declines it.</p>
          <p>
            <Link className="pt-btn pt-btn-primary" href="/request">
              Request a visit
            </Link>
          </p>
        </EmptyState>
      ) : null}
      <section className="pt-card">
        <h2 className="pt-h1" style={{ fontSize: "1.2rem" }}>
          Need to be seen?
        </h2>
        <p className="pt-muted">Choose a visit type, fill any required details, and pick an open time.</p>
        <p>
          <Link href="/request">Start a request</Link>
        </p>
      </section>
    </div>
  );
}
