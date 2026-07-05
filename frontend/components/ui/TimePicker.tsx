"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value: string; // "HH:MM" (24h)
  onChange: (v: string) => void;
  ariaLabel?: string;
  /** Minutes added/removed by ArrowUp/ArrowDown. */
  step?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Live-formats raw input into a partial "HH:MM" as the user types. */
function autoFormat(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Normalizes typed text to a valid clamped "HH:MM", or null if empty/invalid. */
function normalize(text: string): string | null {
  const d = text.replace(/\D/g, "").slice(0, 4);
  if (!d.length) return null;
  const h = parseInt(d.length <= 2 ? d : d.slice(0, 2), 10);
  const m = d.length <= 2 ? 0 : parseInt(d.slice(2), 10);
  if (Number.isNaN(h)) return null;
  return `${pad(Math.min(23, h))}:${pad(Math.min(59, Number.isNaN(m) ? 0 : m))}`;
}

/**
 * Typeable time field (Material-UI style): type "0930", it formats to "09:30",
 * validates on blur, and ArrowUp/ArrowDown nudge the time. No long dropdown.
 */
export function TimePicker({ value, onChange, ariaLabel, step = 30 }: TimePickerProps) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = (t: string) => {
    const n = normalize(t);
    if (n) {
      onChange(n);
      setText(n);
    } else {
      setText(value);
    }
  };

  const bump = (delta: number) => {
    const [h, m] = value.split(":").map(Number);
    const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
    const v = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
    onChange(v);
    setText(v);
  };

  return (
    <div className="relative w-[92px]">
      <input
        aria-label={ariaLabel}
        inputMode="numeric"
        placeholder="HH:MM"
        value={text}
        onChange={(e) => setText(autoFormat(e.target.value))}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(step);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(-step);
          } else if (e.key === "Enter") {
            commit(text);
          }
        }}
        className="h-9 w-full rounded-lg border border-border bg-surface pl-2.5 pr-7 text-xs outline-none transition focus:ring-2 focus:ring-primary/40"
      />
      <Clock className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
