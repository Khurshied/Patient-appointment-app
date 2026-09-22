"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppointmentCard } from "./AppointmentViews";
import { errorMessage, fetchAppointments, type Appointment } from "./api";
import { useSettings } from "./hooks";
import { Alert, EmptyState } from "./ui";

export function AppointmentList() {
  const params = useSearchParams();
  const submitted = params.get("submitted") === "1";
  const { settings, loading: settingsLoading } = useSettings();
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAppointments();
        if (!cancelled) {
          setItems(
            list.slice().sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()),
          );
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pt-stack">
      <div>
        <h1 className="pt-h1">My appointments</h1>
        <p className="pt-lede">Status updates after the practice reviews each request.</p>
      </div>
      {submitted ? (
        <Alert tone="ok">Your request was sent. You will be notified when it is confirmed or declined.</Alert>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}
      {items === null || settingsLoading ? <p className="pt-muted">Loading appointments…</p> : null}
      {items && items.length === 0 ? (
        <EmptyState title="No appointments yet">
          <Link className="pt-btn pt-btn-primary" href="/request">
            Request a visit
          </Link>
        </EmptyState>
      ) : null}
      {settings && items
        ? items.map((a) => <AppointmentCard key={a.id} appointment={a} settings={settings} />)
        : null}
    </div>
  );
}
