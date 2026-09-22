"use client";

import { useEffect, useState } from "react";
import {
  createException,
  deleteException,
  fetchExceptions,
  fetchHours,
  patchSettings,
  saveHours,
  weekdayLabel,
} from "../api";
import { useStaff } from "../StaffShell";
import type {
  HoursException,
  HoursMode,
  TimeInterval,
  WeekdayKey,
  WeeklyHours,
} from "../types";
import { WEEKDAY_KEYS } from "../types";
import { Banner, Button, Field } from "../ui";

function emptyWeek(): WeeklyHours {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

export function HoursPanel() {
  const { settings, refreshSettings } = useStaff();
  const [mode, setMode] = useState<HoursMode>(settings.hoursMode);
  const [weekly, setWeekly] = useState<WeeklyHours>(
    settings.weeklyHours ?? emptyWeek(),
  );
  const [exceptions, setExceptions] = useState<HoursException[]>([]);
  const [exDate, setExDate] = useState("");
  const [exKind, setExKind] = useState<"open" | "closed">("closed");
  const [exStart, setExStart] = useState("09:00");
  const [exEnd, setExEnd] = useState("13:00");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const hours = await fetchHours();
        setWeekly(hours.weeklyHours);
        if (hours.hoursMode) setMode(hours.hoursMode);
      } catch {
        /* GET /api/settings already seeded weekly hours for admins */
      }
      try {
        setExceptions(await fetchExceptions());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load exceptions");
      }
    })();
  }, []);

  function setDay(key: WeekdayKey, intervals: TimeInterval[]) {
    setWeekly((prev) => ({ ...prev, [key]: intervals }));
  }

  return (
    <div className="staff-card">
      <h2 style={{ marginTop: 0 }}>Working hours</h2>
      <p className="staff-muted">
        Weekly template and dated exceptions. Closures win over the template; extra opens add
        availability the template would not have. One-off blocked time is on the calendar.
      </p>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {ok ? <Banner tone="ok">{ok}</Banner> : null}
      <Field label="Hours mode">
        <select value={mode} onChange={(e) => setMode(e.target.value as HoursMode)}>
          <option value="both">Weekly template and exceptions</option>
          <option value="weekly_template">Weekly template only</option>
          <option value="exceptions_enabled">Exceptions only (dated opens)</option>
        </select>
      </Field>
      {WEEKDAY_KEYS.map((key) => {
        const intervals = weekly[key] ?? [];
        const closed = intervals.length === 0;
        return (
          <div key={key} className="staff-card" style={{ boxShadow: "none" }}>
            <strong>{weekdayLabel(key)}</strong>
            <label className="staff-muted" style={{ display: "block", margin: "0.4rem 0" }}>
              <input
                type="checkbox"
                checked={closed}
                onChange={(e) =>
                  setDay(
                    key,
                    e.target.checked
                      ? []
                      : [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "17:00" }],
                  )
                }
              />{" "}
              Closed
            </label>
            {!closed
              ? intervals.map((interval, index) => (
                  <div key={index} className="staff-actions">
                    <input
                      type="time"
                      value={interval.start}
                      onChange={(e) =>
                        setDay(
                          key,
                          intervals.map((item, i) =>
                            i === index ? { ...item, start: e.target.value } : item,
                          ),
                        )
                      }
                    />
                    <input
                      type="time"
                      value={interval.end}
                      onChange={(e) =>
                        setDay(
                          key,
                          intervals.map((item, i) =>
                            i === index ? { ...item, end: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))
              : null}
            {!closed ? (
              <Button
                variant="ghost"
                onClick={() =>
                  setDay(key, [...intervals, { start: "13:00", end: "17:00" }])
                }
              >
                Add interval
              </Button>
            ) : null}
          </div>
        );
      })}
      <Button
        onClick={async () => {
          try {
            await saveHours({ hoursMode: mode, weeklyHours: weekly });
            await refreshSettings();
            setOk("Hours saved");
            setError(null);
          } catch {
            try {
              await patchSettings({ hoursMode: mode, weeklyHours: weekly });
              await refreshSettings();
              setOk("Hours saved");
              setError(null);
            } catch (inner) {
              setError(inner instanceof Error ? inner.message : "Could not save hours");
            }
          }
        }}
      >
        Save weekly hours
      </Button>

      <h3>Exceptions</h3>
      <table className="staff-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Kind</th>
            <th>Intervals</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {exceptions.map((row) => (
            <tr key={row.id}>
              <td>{row.date}</td>
              <td>{row.kind}</td>
              <td>
                {(row.intervals ?? [])
                  .map((interval) => `${interval.start}–${interval.end}`)
                  .join(", ") || "—"}
              </td>
              <td>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await deleteException(row.id);
                    setExceptions(await fetchExceptions());
                  }}
                >
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Field label="Date">
        <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} />
      </Field>
      <Field label="Kind">
        <select
          value={exKind}
          onChange={(e) => setExKind(e.target.value as "open" | "closed")}
        >
          <option value="closed">Closure (holiday)</option>
          <option value="open">Extra open (e.g. Saturday clinic)</option>
        </select>
      </Field>
      {exKind === "open" ? (
        <div className="staff-actions">
          <input type="time" value={exStart} onChange={(e) => setExStart(e.target.value)} />
          <input type="time" value={exEnd} onChange={(e) => setExEnd(e.target.value)} />
        </div>
      ) : null}
      <Button
        style={{ marginTop: "0.75rem" }}
        onClick={async () => {
          try {
            await createException({
              date: exDate,
              kind: exKind,
              intervals: exKind === "open" ? [{ start: exStart, end: exEnd }] : [],
            });
            setExceptions(await fetchExceptions());
            setOk("Exception added");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not add exception");
          }
        }}
      >
        Add exception
      </Button>
    </div>
  );
}
