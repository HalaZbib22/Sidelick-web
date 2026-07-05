"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { WheelColumn, type WheelOption } from "./WheelColumn";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const dayISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Build a local Date from a "YYYY-MM-DD" day + 24h hour + minute. */
function atLocal(day: string, h24: number, m: number): Date {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(y, mo - 1, d, h24, m, 0, 0);
}

const to24 = (h12: number, period: "AM" | "PM") =>
  period === "PM" ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
const from24 = (h24: number) => ({
  h12: h24 % 12 === 0 ? 12 : h24 % 12,
  period: (h24 >= 12 ? "PM" : "AM") as "AM" | "PM",
});

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function dayLabel(d: Date, today: Date): string {
  const diff = Math.round((startOfDay(d) - startOfDay(today)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

interface DateTimePickerProps {
  value: Date;
  onChange: (d: Date) => void;
  /** Earliest selectable instant. Times before it are disabled. */
  minDate?: Date;
  /** How many days forward the date wheel spans. Default 90. */
  daysAhead?: number;
  /** Minute granularity. Default 5. */
  minuteStep?: number;
  ariaLabel?: string;
}

/**
 * MUI-mobile-style date + time picker: a trigger that opens a popover of
 * scroll-snapping wheels (day / hour / minute / AM-PM). Built on WheelColumn,
 * no third-party dependency. Times earlier than `minDate` are disabled so the
 * user can't pick an invalid slot.
 */
export function DateTimePicker({
  value,
  onChange,
  minDate,
  daysAhead = 90,
  minuteStep = 5,
  ariaLabel = "Date and time",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const today = new Date();
  const min = minDate ?? today;

  const selDay = dayISO(value);
  const { h12, period } = from24(value.getHours());
  const selMin = Math.round(value.getMinutes() / minuteStep) * minuteStep;

  // Day options — today forward, skipping any day fully before `min`.
  const dayOpts: WheelOption[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const lastSlot = atLocal(dayISO(d), 23, 55);
    dayOpts.push({ value: dayISO(d), label: dayLabel(new Date(d), today), disabled: lastSlot < min });
  }

  // A candidate slot is disabled if it falls before `min`.
  const slotDisabled = (h24: number, m: number) => atLocal(selDay, h24, m) < min;

  const hourOpts: WheelOption[] = Array.from({ length: 12 }, (_, i) => {
    const hh = i + 1;
    const h24 = to24(hh, period);
    return { value: String(hh), label: String(hh), disabled: slotDisabled(h24, 55) };
  });
  const minuteOpts: WheelOption[] = [];
  for (let m = 0; m < 60; m += minuteStep) {
    minuteOpts.push({ value: String(m), label: pad(m), disabled: slotDisabled(to24(h12, period), m) });
  }
  const periodOpts: WheelOption[] = (["AM", "PM"] as const).map((p) => ({
    value: p,
    label: p,
    disabled: atLocal(selDay, to24(h12, p), 55) < min,
  }));

  /** Rebuild the Date from one changed component and clamp to `min`. */
  const commit = (next: { day?: string; h12?: number; period?: "AM" | "PM"; min?: number }) => {
    const day = next.day ?? selDay;
    const p = next.period ?? period;
    const hh = next.h12 ?? h12;
    const mm = next.min ?? selMin;
    let d = atLocal(day, to24(hh, p), mm);
    if (d < min) d = min;
    onChange(d);
  };

  const trigger = value.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-surface px-3.5 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
      >
        <span className="font-medium">{trigger}</span>
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={popRef}
            role="dialog"
            aria-label={ariaLabel}
            className="absolute left-0 right-0 z-50 mt-2 rounded-2xl border border-border bg-surface p-3 shadow-xl"
          >
            <div className="relative flex gap-1">
              {/* Centered selection band behind the wheels. */}
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 rounded-lg bg-muted/60" />
              <WheelColumn ariaLabel="Day" options={dayOpts} value={selDay} onChange={(v) => commit({ day: v })} />
              <WheelColumn
                ariaLabel="Hour"
                options={hourOpts}
                value={String(h12)}
                onChange={(v) => commit({ h12: Number(v) })}
              />
              <WheelColumn
                ariaLabel="Minute"
                options={minuteOpts}
                value={String(selMin)}
                onChange={(v) => commit({ min: Number(v) })}
              />
              <WheelColumn
                ariaLabel="AM or PM"
                options={periodOpts}
                value={period}
                onChange={(v) => commit({ period: v as "AM" | "PM" })}
              />
            </div>
            <Button className={cn("mt-3 w-full")} onClick={() => setOpen(false)}>
              <Check className="h-4 w-4" /> Done
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
