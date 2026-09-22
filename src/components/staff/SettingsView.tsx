"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStaff } from "./StaffShell";
import { AuthPanel } from "./settings/AuthPanel";
import { CompletionPanel } from "./settings/CompletionPanel";
import { HoursPanel } from "./settings/HoursPanel";
import { IntakePanel } from "./settings/IntakePanel";
import { LocalePanel } from "./settings/LocalePanel";
import { PoliciesPanel } from "./settings/PoliciesPanel";
import { RemindersPanel } from "./settings/RemindersPanel";
import { TypesPanel } from "./settings/TypesPanel";
import { UsersPanel } from "./settings/UsersPanel";

const TABS = [
  { id: "types", label: "Types" },
  { id: "hours", label: "Hours" },
  { id: "policies", label: "Policies" },
  { id: "reminders", label: "Reminders" },
  { id: "auth", label: "Auth" },
  { id: "intake", label: "Intake" },
  { id: "locale", label: "Locale" },
  { id: "completion", label: "Complete / no-show" },
  { id: "users", label: "Users" },
] as const;

export type SettingsTab = (typeof TABS)[number]["id"];

export function SettingsView() {
  const { user } = useStaff();
  const search = useSearchParams();
  const tab = (search.get("tab") as SettingsTab) || "types";

  if (!user.roles.includes("admin")) {
    return (
      <section>
        <h1>Settings</h1>
        <p className="staff-muted">Practice settings are available to admin accounts only.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="staff-page-head">
        <div>
          <h1>Settings</h1>
          <p>Practice catalog from the product spec: types, hours, policies, reminders, auth, intake, locale, users.</p>
        </div>
      </div>
      <div className="staff-settings">
        <nav className="staff-settings-nav">
          {TABS.map((item) => (
            <Link
              key={item.id}
              href={`/settings?tab=${item.id}`}
              className={tab === item.id ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div>
          {tab === "types" ? <TypesPanel /> : null}
          {tab === "hours" ? <HoursPanel /> : null}
          {tab === "policies" ? <PoliciesPanel /> : null}
          {tab === "reminders" ? <RemindersPanel /> : null}
          {tab === "auth" ? <AuthPanel /> : null}
          {tab === "intake" ? <IntakePanel /> : null}
          {tab === "locale" ? <LocalePanel /> : null}
          {tab === "completion" ? <CompletionPanel /> : null}
          {tab === "users" ? <UsersPanel /> : null}
        </div>
      </div>
    </section>
  );
}
