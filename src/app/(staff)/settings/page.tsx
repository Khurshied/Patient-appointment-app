import { Suspense } from "react";
import { SettingsView } from "../../../components/staff/SettingsView";

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="staff-muted">Loading settings…</p>}>
      <SettingsView />
    </Suspense>
  );
}
