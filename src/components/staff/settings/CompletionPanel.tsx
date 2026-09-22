"use client";

import { useState } from "react";
import { patchSettings } from "../api";
import { useStaff } from "../StaffShell";
import type { CompleteMode } from "../types";
import { Banner, Button, Field } from "../ui";

export function CompletionPanel() {
  const { settings, refreshSettings } = useStaff();
  const [mode, setMode] = useState<CompleteMode>(settings.completeMode);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Complete / no-show</h2>
      <p className="staff-muted">
        Staff can always mark a confirmed visit. If required, overdue items appear in Needs
        close-out by end of the visit’s calendar day in the practice timezone. Status is not
        auto-changed when the deadline passes.
      </p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <Field label="Close-out rule">
        <select value={mode} onChange={(e) => setMode(e.target.value as CompleteMode)}>
          <option value="optional">Optional — visits may stay confirmed after end time</option>
          <option value="required">Required — mark completed or no-show by end of day</option>
        </select>
      </Field>
      <Button
        onClick={async () => {
          try {
            await patchSettings({ completeMode: mode });
            await refreshSettings();
            setOk("Completion rule saved");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        }}
      >
        Save
      </Button>
    </div>
  );
}
