"use client";

import { useState } from "react";
import { patchSettings } from "../api";
import { useStaff } from "../StaffShell";
import { Banner, Button, Field } from "../ui";

const OFFSET_OPTIONS = ["48h", "24h", "12h", "6h", "2h", "1h", "30m"];

export function RemindersPanel() {
  const { settings, refreshSettings } = useStaff();
  const [offsets, setOffsets] = useState<string[]>(settings.reminderOffsets);
  const [channels, setChannels] = useState(settings.channels);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function toggleOffset(value: string) {
    setOffsets((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  }

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Reminders</h2>
      <p className="staff-muted">
        Confirmed visits fire each offset before start on every enabled channel the patient can
        receive. Offsets already in the past at confirm time are skipped.
      </p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <Field label="Offsets before start">
        <div className="staff-check-row">
          {OFFSET_OPTIONS.map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={offsets.includes(value)}
                onChange={() => toggleOffset(value)}
              />
              {value}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Add custom offset" hint="Examples: 24h, 1h, 15m">
        <div className="staff-actions">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} />
          <Button
            variant="secondary"
            onClick={() => {
              if (custom.trim()) {
                setOffsets((prev) => [...prev, custom.trim()]);
                setCustom("");
              }
            }}
          >
            Add
          </Button>
        </div>
      </Field>
      <p className="staff-muted">Active: {offsets.join(", ") || "none"}</p>
      <Field label="Practice-level channels">
        <div className="staff-check-row">
          {(["email", "sms", "push"] as const).map((channel) => (
            <label key={channel}>
              <input
                type="checkbox"
                checked={channels[channel]}
                onChange={(e) =>
                  setChannels((prev) => ({ ...prev, [channel]: e.target.checked }))
                }
              />
              {channel}
            </label>
          ))}
        </div>
      </Field>
      <Button
        onClick={async () => {
          try {
            await patchSettings({
              reminderOffsets: offsets,
              channels,
            });
            await refreshSettings();
            setOk("Reminders saved");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        }}
      >
        Save reminders
      </Button>
    </div>
  );
}
