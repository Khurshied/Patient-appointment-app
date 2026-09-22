"use client";

import { useState } from "react";
import { patchSettings } from "../api";
import { useStaff } from "../StaffShell";
import type { IntakeField, IntakeRequirement } from "../types";
import { Banner, Button, Field } from "../ui";

export function IntakePanel() {
  const { settings, refreshSettings } = useStaff();
  const [fields, setFields] = useState<IntakeField[]>(settings.intake);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"text" | "date">("text");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function setRequirement(id: string, requirement: IntakeRequirement) {
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, requirement } : field)),
    );
  }

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Intake fields</h2>
      <p className="staff-muted">
        Identity (email or phone) is always required. Built-ins: display name and date of birth.
        Extra text or date fields are optional.
      </p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <table className="staff-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Required</th>
            <th>Optional</th>
            <th>Off</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.id}>
              <td>
                {field.label}
                <div className="staff-muted">{field.kind}</div>
              </td>
              {(["required", "optional", "off"] as const).map((mode) => (
                <td key={mode}>
                  <input
                    type="radio"
                    name={field.id}
                    checked={field.requirement === mode}
                    onChange={() => setRequirement(field.id, mode)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Add extra field</h3>
      <Field label="Label">
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field label="Kind">
        <select value={kind} onChange={(e) => setKind(e.target.value as "text" | "date")}>
          <option value="text">Text</option>
          <option value="date">Date</option>
        </select>
      </Field>
      <Button
        variant="secondary"
        onClick={() => {
          if (!label.trim()) return;
          const id = label.trim().replace(/\s+/g, "_").toLowerCase();
          setFields((prev) => [
            ...prev,
            { id, label: label.trim(), kind, requirement: "optional" },
          ]);
          setLabel("");
        }}
      >
        Add field
      </Button>
      <div style={{ marginTop: "1rem" }}>
        <Button
          onClick={async () => {
            try {
              await patchSettings({ intake: fields });
              await refreshSettings();
              setOk("Intake saved");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            }
          }}
        >
          Save intake
        </Button>
      </div>
    </div>
  );
}
