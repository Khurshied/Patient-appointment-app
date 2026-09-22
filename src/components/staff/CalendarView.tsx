"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createBlock, deleteBlock, fetchAppointments, fetchBlocks } from "./api";
import {
  addDays,
  formatTime,
  hourInZone,
  startOfWeek,
  ymdInZone,
} from "./format";
import { useStaff } from "./StaffShell";
import type { Appointment, TimeBlock } from "./types";
import { Banner, Button, EmptyState, Field, Modal } from "./ui";

type ViewMode = "day" | "week";

function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CalendarView() {
  const { settings } = useStaff();
  const tz = settings.timezone || undefined;
  const [mode, setMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showBlock, setShowBlock] = useState(false);
  const [blockStart, setBlockStart] = useState(localInputValue(new Date()));
  const [blockEnd, setBlockEnd] = useState(
    localInputValue(new Date(Date.now() + 60 * 60_000)),
  );
  const [blockNote, setBlockNote] = useState("");

  const range = useMemo(() => {
    if (mode === "day") {
      const ymd = ymdInZone(anchor, tz);
      return {
        from: `${ymd}T00:00:00.000Z`,
        to: `${ymd}T23:59:59.999Z`,
        days: [ymd],
      };
    }
    const weekStart = startOfWeek(anchor, tz);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return d.toISOString().slice(0, 10);
    });
    return {
      from: `${days[0]}T00:00:00.000Z`,
      to: `${days[6]}T23:59:59.999Z`,
      days,
    };
  }, [anchor, mode, tz]);

  const load = useCallback(async () => {
    try {
      const [appts, timeBlocks] = await Promise.all([
        fetchAppointments({ from: range.from, to: range.to }),
        fetchBlocks(),
      ]);
      setAppointments(
        appts.filter((row) => row.status === "confirmed" || row.status === "requested"),
      );
      setBlocks(timeBlocks);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load calendar");
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmed = appointments.filter((row) => row.status === "confirmed");

  async function addBlock() {
    try {
      await createBlock({
        start: new Date(blockStart).toISOString(),
        end: new Date(blockEnd).toISOString(),
        reason: blockNote || undefined,
      });
      setShowBlock(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add blocked time");
    }
  }

  function itemsForDay(ymd: string) {
    const appts = confirmed.filter((row) => ymdInZone(new Date(row.start), tz) === ymd);
    const dayBlocks = blocks.filter(
      (row) => ymdInZone(new Date(row.start), tz) === ymd,
    );
    return { appts, dayBlocks };
  }

  const heading =
    mode === "day"
      ? new Intl.DateTimeFormat(undefined, {
          timeZone: tz,
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(anchor)
      : `Week of ${range.days[0]}`;

  return (
    <section>
      <div className="staff-page-head">
        <div>
          <h1>Calendar</h1>
          <p>Confirmed visits and blocked time. Pending requests stay in Inbox until confirmed.</p>
        </div>
        <div className="staff-actions">
          <Button variant="secondary" onClick={() => setMode(mode === "day" ? "week" : "day")}>
            {mode === "day" ? "Week view" : "Day view"}
          </Button>
          <Button onClick={() => setShowBlock(true)}>Add blocked time</Button>
        </div>
      </div>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <div className="staff-cal-toolbar">
        <div className="staff-actions">
          <Button
            variant="secondary"
            onClick={() =>
              setAnchor(addDays(anchor, mode === "day" ? -1 : -7))
            }
          >
            Previous
          </Button>
          <Button variant="ghost" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button
            variant="secondary"
            onClick={() => setAnchor(addDays(anchor, mode === "day" ? 1 : 7))}
          >
            Next
          </Button>
        </div>
        <strong>{heading}</strong>
      </div>

      {mode === "week" ? (
        <div className="staff-week">
          {range.days.map((ymd) => {
            const { appts, dayBlocks } = itemsForDay(ymd);
            return (
              <div key={ymd} className="staff-week-col">
                <h3>{ymd}</h3>
                {appts.length === 0 && dayBlocks.length === 0 ? (
                  <p className="staff-muted">Open</p>
                ) : null}
                {appts.map((row) => (
                  <Link
                    key={row.id}
                    className="staff-event"
                    href={`/visit/${row.id}`}
                  >
                    <strong>{formatTime(row.start, tz)}</strong>
                    <div>{row.patient?.displayName ?? "Patient"}</div>
                    <div>{row.typeName ?? row.type?.name}</div>
                  </Link>
                ))}
                {dayBlocks.map((row) => (
                  <div key={row.id} className="staff-event block">
                    <strong>{formatTime(row.start, tz)}–{formatTime(row.end, tz)}</strong>
                    <div>{row.reason || "Blocked"}</div>
                    <Button
                      variant="ghost"
                      onClick={() => void deleteBlock(row.id).then(load)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <DayTimeline
          ymd={range.days[0]}
          appointments={itemsForDay(range.days[0]).appts}
          blocks={itemsForDay(range.days[0]).dayBlocks}
          tz={tz}
          onRemoveBlock={(id) => void deleteBlock(id).then(load)}
        />
      )}

      {showBlock ? (
        <Modal title="Add blocked time" onClose={() => setShowBlock(false)}>
          <Field label="Starts">
            <input
              type="datetime-local"
              value={blockStart}
              onChange={(e) => setBlockStart(e.target.value)}
            />
          </Field>
          <Field label="Ends">
            <input
              type="datetime-local"
              value={blockEnd}
              onChange={(e) => setBlockEnd(e.target.value)}
            />
          </Field>
          <Field label="Note" hint="Optional. Patients will not see this as a bookable slot.">
            <input
              value={blockNote}
              onChange={(e) => setBlockNote(e.target.value)}
              placeholder="Personal, overflow, holiday prep…"
            />
          </Field>
          <div className="staff-actions">
            <Button onClick={() => void addBlock()}>Save block</Button>
            <Button variant="ghost" onClick={() => setShowBlock(false)}>
              Cancel
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function DayTimeline({
  ymd,
  appointments,
  blocks,
  tz,
  onRemoveBlock,
}: {
  ymd: string;
  appointments: Appointment[];
  blocks: TimeBlock[];
  tz?: string;
  onRemoveBlock: (id: string) => void;
}) {
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);
  if (appointments.length === 0 && blocks.length === 0) {
    return (
      <EmptyState title={`Nothing on ${ymd}`} body="Confirmed visits and blocks appear on this day." />
    );
  }
  return (
    <div className="staff-day-grid">
      {hours.map((hour) => (
        <div key={hour} className="staff-hour">
          <span>{hour}:00</span>
          <div>
            {appointments
              .filter((row) => hourInZone(row.start, tz) === hour)
              .map((row) => (
                <Link key={row.id} className="staff-event" href={`/visit/${row.id}`}>
                  {formatTime(row.start, tz)} {row.patient?.displayName} ·{" "}
                  {row.typeName ?? row.type?.name}
                </Link>
              ))}
            {blocks
              .filter((row) => hourInZone(row.start, tz) === hour)
              .map((row) => (
                <div key={row.id} className="staff-event block">
                  {formatTime(row.start, tz)}–{formatTime(row.end, tz)} {row.reason || "Blocked"}{" "}
                  <Button variant="ghost" onClick={() => onRemoveBlock(row.id)}>
                    Remove
                  </Button>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
