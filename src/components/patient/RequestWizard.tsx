"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  errorMessage,
  fetchSlots,
  type AppointmentType,
  type IntakeField,
  type Me,
  type Settings,
  type Slot,
} from "./api";
import { addDaysYmd, formatTime, ymdInZone } from "./format";
import { Alert, Button, EmptyState, Field } from "./ui";

const STEPS = ["Visit type", "About you", "Date", "Time", "Review"] as const;

function requiredIntake(fields: IntakeField[]) {
  return fields.filter((f) => f.requirement === "required");
}

export function RequestWizard({
  settings,
  me,
  initialTypeId,
  rescheduleId,
}: {
  settings: Settings;
  me: Me | null;
  initialTypeId?: string;
  rescheduleId?: string;
}) {
  const router = useRouter();
  const types = settings.appointmentTypes.filter((t) => t.active);
  const [step, setStep] = useState(0);
  const [typeId, setTypeId] = useState(initialTypeId ?? "");
  const [intake, setIntake] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (me?.displayName) initial.displayName = me.displayName;
    if (me?.dateOfBirth) {
      initial.dob = me.dateOfBirth.slice(0, 10);
      initial.dateOfBirth = me.dateOfBirth.slice(0, 10);
    }
    return initial;
  });
  const [date, setDate] = useState(() => ymdInZone(new Date(), settings.timezone));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [start, setStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setIntake((prev) => ({
      ...prev,
      displayName: prev.displayName || me.displayName || "",
      dob: prev.dob || me.dateOfBirth?.slice(0, 10) || "",
      dateOfBirth: prev.dateOfBirth || me.dateOfBirth?.slice(0, 10) || "",
    }));
  }, [me]);

  const selectedType: AppointmentType | undefined = types.find((t) => t.id === typeId);
  const needed = useMemo(() => requiredIntake(settings.intakeFields), [settings.intakeFields]);
  const optionalVisible = settings.intakeFields.filter((f) => f.requirement === "optional");
  const intakeFields = [...needed, ...optionalVisible.filter((f) => !needed.some((n) => n.key === f.key))];

  function goAfterType() {
    if (!typeId) {
      setError("Choose a visit type to continue.");
      return;
    }
    setError(null);
    if (intakeFields.length === 0) {
      setStep(2);
    } else {
      setStep(1);
    }
  }

  function goAfterIntake() {
    for (const field of needed) {
      if (!String(intake[field.key] ?? "").trim()) {
        setError(`Please fill in ${field.label}.`);
        return;
      }
    }
    setError(null);
    setStep(2);
  }

  async function loadSlots(nextDate = date) {
    if (!typeId) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const list = await fetchSlots(typeId, nextDate);
      setSlots(list);
    } catch (err) {
      setSlots(null);
      setSlotsError(errorMessage(err, "Could not load open times for that day."));
    } finally {
      setSlotsLoading(false);
    }
  }

  async function goDate() {
    setError(null);
    setStart("");
    await loadSlots(date);
    setStep(3);
  }

  async function submit() {
    if (!selectedType || !start) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        typeId,
        start,
      };
      const cleaned = Object.fromEntries(Object.entries(intake).filter(([, v]) => String(v).trim()));
      if (Object.keys(cleaned).length) payload.intake = cleaned;

      if (rescheduleId) {
        await api(`/api/appointments/${encodeURIComponent(rescheduleId)}/reschedule`, {
          method: "POST",
          body: JSON.stringify({ start }),
        });
      } else {
        await api("/api/appointments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      router.replace("/appointments?submitted=1");
      router.refresh();
    } catch (err) {
      const msg = errorMessage(err, "Could not submit that request.");
      if (/no longer available|conflict|409/i.test(msg)) {
        setError("That slot is no longer available. Please pick another time.");
        await loadSlots();
        setStep(3);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  if (types.length === 0) {
    return (
      <EmptyState title="No visit types yet">
        The practice has not published appointment types. Please check back later or call the office.
      </EmptyState>
    );
  }

  return (
    <div>
      <ol className="pt-steps" aria-label="Request steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {error ? <Alert>{error}</Alert> : null}

      {step === 0 ? (
        <div className="pt-stack">
          <p className="pt-lede">Choose the kind of visit. Slot length is set by the practice.</p>
          <div className="pt-choice-grid">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                className="pt-choice"
                aria-pressed={typeId === t.id}
                onClick={() => setTypeId(t.id)}
              >
                {t.name}
                <small>{t.durationMinutes} minutes</small>
              </button>
            ))}
          </div>
          <Button onClick={goAfterType} disabled={!typeId}>
            Continue
          </Button>
        </div>
      ) : null}

      {step === 1 ? (
        <form
          className="pt-stack"
          onSubmit={(e) => {
            e.preventDefault();
            goAfterIntake();
          }}
        >
          <p className="pt-lede">A few details the practice needs before they can review your request.</p>
          {intakeFields.map((field) => (
            <Field key={field.key} label={field.label} htmlFor={field.key} hint={field.requirement === "optional" ? "Optional" : undefined}>
              {field.type === "textarea" ? (
                <textarea
                  id={field.key}
                  className="pt-textarea"
                  required={field.requirement === "required"}
                  value={intake[field.key] ?? ""}
                  onChange={(e) => setIntake((s) => ({ ...s, [field.key]: e.target.value }))}
                />
              ) : (
                <input
                  id={field.key}
                  className="pt-input"
                  type={field.type === "date" ? "date" : field.type === "tel" ? "tel" : field.type === "email" ? "email" : "text"}
                  required={field.requirement === "required"}
                  value={intake[field.key] ?? ""}
                  onChange={(e) => setIntake((s) => ({ ...s, [field.key]: e.target.value }))}
                />
              )}
            </Field>
          ))}
          <div className="pt-row">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button type="submit">Continue</Button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="pt-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void goDate();
          }}
        >
          <p className="pt-lede">
            Times are shown in {settings.timezone.replace(/_/g, " ")}. Pick a day; we will list open slots next.
          </p>
          <div className="pt-date-nav">
            <Button
              variant="ghost"
              onClick={() => setDate((d) => addDaysYmd(d, -1))}
              aria-label="Previous day"
            >
              Previous
            </Button>
            <input
              className="pt-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              aria-label="Visit date"
            />
            <Button variant="ghost" onClick={() => setDate((d) => addDaysYmd(d, 1))} aria-label="Next day">
              Next
            </Button>
          </div>
          <div className="pt-row">
            <Button variant="ghost" onClick={() => setStep(intakeFields.length ? 1 : 0)}>
              Back
            </Button>
            <Button type="submit">Show open times</Button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <div className="pt-stack">
          <p className="pt-lede">
            Open times for {date}
            {selectedType ? ` · ${selectedType.name} (${selectedType.durationMinutes} min)` : ""}.
          </p>
          {slotsError ? <Alert>{slotsError}</Alert> : null}
          {slotsLoading ? <p className="pt-muted">Looking up availability…</p> : null}
          {!slotsLoading && slots && slots.length === 0 ? (
            <p className="pt-muted">No open times on this day. Try another date.</p>
          ) : null}
          <div className="pt-slots" role="list">
            {(slots ?? []).map((slot) => (
              <button
                key={slot.start}
                type="button"
                className="pt-choice"
                data-selected={start === slot.start}
                onClick={() => setStart(slot.start)}
              >
                {slot.label || formatTime(slot.start, settings.timezone, settings.defaultLocale)}
              </button>
            ))}
          </div>
          <div className="pt-row">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button disabled={!start} onClick={() => setStep(4)}>
              Review request
            </Button>
            <Button variant="ghost" onClick={() => void loadSlots()}>
              Refresh times
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 && selectedType ? (
        <div className="pt-stack">
          <div className="pt-card">
            <p className="pt-kicker">{rescheduleId ? "Reschedule request" : "New request"}</p>
            <h2 className="pt-h1" style={{ fontSize: "1.4rem" }}>
              {selectedType.name}
            </h2>
            <p>
              {formatTime(start, settings.timezone, settings.defaultLocale)} on {date} · {selectedType.durationMinutes}{" "}
              minutes
            </p>
            <p className="pt-muted">This is a request. The dentist or admin will confirm or decline it.</p>
            {Object.keys(intake).length ? (
              <dl>
                {Object.entries(intake).map(([k, v]) => (
                  <div key={k}>
                    <dt className="pt-muted">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
          <div className="pt-row">
            <Button variant="ghost" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? "Submitting…" : rescheduleId ? "Submit new time" : "Submit request"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
