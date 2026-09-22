"use client";

import { useEffect, useState } from "react";
import { AppointmentDetailView } from "./AppointmentViews";
import { errorMessage, fetchAppointments, parseAppointment, type Appointment, api } from "./api";
import { useSettings } from "./hooks";
import { Alert } from "./ui";

export function AppointmentDetail({ id }: { id: string }) {
  const { settings, loading: settingsLoading, error: settingsError } = useSettings();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        try {
          const data = await api(`/api/appointments/${encodeURIComponent(id)}`);
          const parsed = parseAppointment(data);
          if (parsed) {
            if (!cancelled) setAppointment(parsed);
            return;
          }
        } catch {
          // Fall back to the collection endpoint if detail is not implemented yet.
        }
        const list = await fetchAppointments();
        const found = list.find((a) => a.id === id) ?? null;
        if (!cancelled) {
          setAppointment(found);
          if (!found) setError("We could not find that appointment.");
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, "We could not load that appointment."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error || settingsError) return <Alert>{error || settingsError}</Alert>;
  if (!appointment || !settings || settingsLoading) return <p className="pt-muted">Loading visit…</p>;
  return <AppointmentDetailView appointment={appointment} settings={settings} />;
}
