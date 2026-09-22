"use client";

import { useState } from "react";
import { patchSettings } from "../api";
import { useStaff } from "../StaffShell";
import { Banner, Button, Field } from "../ui";

export function AuthPanel() {
  const { settings, refreshSettings } = useStaff();
  const [password, setPassword] = useState(settings.authPassword);
  const [otp, setOtp] = useState(settings.authOtp);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Auth modes</h2>
      <p className="staff-muted">
        Patients and staff use the same practice modes. At least one of password or OTP must be
        on. When both are on, either method is enough (not mandatory 2FA).
      </p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <Field label="Sign-in methods">
        <div className="staff-check-row">
          <label>
            <input
              type="checkbox"
              checked={password}
              onChange={(e) => setPassword(e.target.checked)}
            />
            Password
          </label>
          <label>
            <input
              type="checkbox"
              checked={otp}
              onChange={(e) => setOtp(e.target.checked)}
            />
            One-time code (OTP)
          </label>
        </div>
      </Field>
      <Button
        onClick={async () => {
          if (!password && !otp) {
            setError("Enable at least one auth mode.");
            return;
          }
          try {
            await patchSettings({ authPassword: password, authOtp: otp });
            await refreshSettings();
            setOk("Auth modes saved");
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        }}
      >
        Save auth
      </Button>
    </div>
  );
}
