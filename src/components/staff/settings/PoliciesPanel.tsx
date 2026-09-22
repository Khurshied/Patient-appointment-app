"use client";

import { useState } from "react";
import { patchSettings } from "../api";
import { useStaff } from "../StaffShell";
import type { CancelPolicy, ContentionPolicy } from "../types";
import { Banner, Button, Field } from "../ui";

export function PoliciesPanel() {
  const { settings, refreshSettings } = useStaff();
  const [contention, setContention] = useState<ContentionPolicy>(
    settings.contentionPolicy,
  );
  const [cancel, setCancel] = useState<CancelPolicy>(settings.cancelPolicy);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Policies</h2>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <Field
        label="Same-slot contention"
        hint="Exactly one policy is active. Changing it applies to new requests."
      >
        <select
          value={contention}
          onChange={(e) => setContention(e.target.value as ContentionPolicy)}
        >
          <option value="hide_on_request">Hide on request</option>
          <option value="hold_first_request">Hold first request</option>
          <option value="queue_until_confirm">Queue until confirm</option>
        </select>
      </Field>
      <p className="staff-muted">
        {contention === "queue_until_confirm"
          ? "Multiple patients may request the same window. First confirmation occupies it; overlapping requested visits are auto-declined."
          : contention === "hold_first_request"
            ? "The first request holds the window. Others cannot request an overlapping time until it is declined or cancelled."
            : "As soon as anyone requests a window, that time disappears from the open list."}
      </p>
      <Field
        label="Cancel / reschedule"
        hint="Patient-facing. Doctor and admin can always cancel or move a visit."
      >
        <select
          value={cancel}
          onChange={(e) => setCancel(e.target.value as CancelPolicy)}
        >
          <option value="until_start">Until start</option>
          <option value="cutoff_24h">Cutoff 24 hours before start</option>
          <option value="cancel_only">Cancel only (no patient reschedule)</option>
          <option value="staff_only">Staff only</option>
        </select>
      </Field>
      <Button
        onClick={async () => {
          try {
            await patchSettings({
              contentionPolicy: contention,
              cancelPolicy: cancel,
            });
            await refreshSettings();
            setOk("Policies saved");
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        }}
      >
        Save policies
      </Button>
    </div>
  );
}
