"use client";

import { useSearchParams } from "next/navigation";
import { RequestWizard } from "./RequestWizard";
import { useMe, useSettings } from "./hooks";
import { Alert } from "./ui";

export function RequestFlow() {
  const params = useSearchParams();
  const { settings, loading, error } = useSettings();
  const { me } = useMe();
  const typeId = params.get("typeId") ?? undefined;
  const reschedule = params.get("reschedule") ?? undefined;

  if (loading) return <p className="pt-muted">Loading practice hours and visit types…</p>;
  if (error || !settings) return <Alert>{error || "Settings are unavailable."}</Alert>;

  return (
    <div>
      <h1 className="pt-h1">{reschedule ? "Reschedule" : "Request a visit"}</h1>
      <p className="pt-lede">
        You are asking for a time, not booking instantly. The dentist or admin confirms before it is on the calendar.
      </p>
      <RequestWizard settings={settings} me={me ?? null} initialTypeId={typeId} rescheduleId={reschedule} />
    </div>
  );
}
