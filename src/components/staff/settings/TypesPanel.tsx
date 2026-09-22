"use client";

import { useEffect, useState } from "react";
import {
  createType,
  deleteType,
  fetchTypes,
  updateType,
} from "../api";
import type { AppointmentType } from "../types";
import { Banner, Button, Field } from "../ui";

export function TypesPanel() {
  const [rows, setRows] = useState<AppointmentType[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await fetchTypes());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load types");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Appointment types</h2>
      <p className="staff-muted">
        There is no hardcoded list. Only active types appear when a patient requests a visit.
        Duration changes apply to new requests only.
      </p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <table className="staff-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Minutes</th>
            <th>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <input
                  value={row.name}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id ? { ...item, name: e.target.value } : item,
                      ),
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={row.durationMinutes}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? { ...item, durationMinutes: Number(e.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={row.active}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((item) =>
                        item.id === row.id ? { ...item, active: e.target.checked } : item,
                      ),
                    )
                  }
                />
              </td>
              <td>
                <div className="staff-actions">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await updateType(row.id, {
                          name: row.name,
                          durationMinutes: row.durationMinutes,
                          active: row.active,
                        });
                        setOk("Type saved");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Save failed");
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      await deleteType(row.id);
                      await load();
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Add type</h3>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Duration (minutes)" hint="Positive integer; 15-minute increments are typical.">
        <input
          type="number"
          min={15}
          step={15}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </Field>
      <Button
        onClick={async () => {
          try {
            await createType({ name, durationMinutes: duration, active: true });
            setName("");
            await load();
            setOk("Type added");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add type");
          }
        }}
      >
        Add type
      </Button>
    </div>
  );
}
