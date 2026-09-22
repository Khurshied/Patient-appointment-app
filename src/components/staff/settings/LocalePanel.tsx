"use client";

import { useState } from "react";
import { patchSettings } from "../api";
import { useStaff } from "../StaffShell";
import { Banner, Button, Field } from "../ui";

const ZONES = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

const LOCALES = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "pt", label: "Portuguese" },
];

export function LocalePanel() {
  const { settings, refreshSettings } = useStaff();
  const [timezone, setTimezone] = useState(settings.timezone);
  const [locales, setLocales] = useState<string[]>(settings.locales);
  const [defaultLocale, setDefaultLocale] = useState(settings.defaultLocale);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Timezone and language</h2>
      <p className="staff-muted">
        Slot times are stored in UTC and shown in the practice zone. Day boundaries use this
        timezone. Do not leave timezone unset in production.
      </p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <Field label="IANA timezone">
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          <option value="">Select a timezone</option>
          {ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </Field>
      <Field label="UI locales the app ships">
        <div className="staff-check-row">
          {LOCALES.map((locale) => (
            <label key={locale.id}>
              <input
                type="checkbox"
                checked={locales.includes(locale.id)}
                onChange={(e) =>
                  setLocales((prev) =>
                    e.target.checked
                      ? [...prev, locale.id]
                      : prev.filter((id) => id !== locale.id),
                  )
                }
              />
              {locale.label}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Default locale">
        <select value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)}>
          {locales.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </Field>
      <Button
        onClick={async () => {
          if (!timezone) {
            setError("Set a practice timezone before going live.");
            return;
          }
          const nextLocales = locales.length ? locales : ["en"];
          try {
            await patchSettings({
              timezone,
              locales: nextLocales,
              defaultLocale: nextLocales.includes(defaultLocale)
                ? defaultLocale
                : nextLocales[0],
            });
            await refreshSettings();
            setOk("Locale saved");
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        }}
      >
        Save locale
      </Button>
    </div>
  );
}
