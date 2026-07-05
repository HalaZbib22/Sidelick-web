"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Live countdown ring shown while a walk/sit is in_progress.
 * Target = actualStartAt + the booked duration (scheduled endAt - startAt).
 * Counts down MM:SS, fills an SVG progress ring, and flips to an "over time"
 * state once the booked duration elapses (the walk can run long — that's fine).
 */
export function WalkCountdown({
  actualStartAt,
  scheduledStartAt,
  scheduledEndAt,
}: {
  actualStartAt: string | null;
  scheduledStartAt: string;
  scheduledEndAt: string;
}) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const bookedMs =
    new Date(scheduledEndAt).getTime() - new Date(scheduledStartAt).getTime();
  const startMs = actualStartAt ? new Date(actualStartAt).getTime() : now;
  const endMs = startMs + bookedMs;

  const totalSec = Math.max(1, Math.round(bookedMs / 1000));
  const remainingSec = Math.round((endMs - now) / 1000);
  const overtime = remainingSec < 0;
  const absSec = Math.abs(remainingSec);
  const mm = String(Math.floor(absSec / 60)).padStart(2, "0");
  const ss = String(absSec % 60).padStart(2, "0");

  // Fraction of the booked duration completed (clamped 0..1).
  const elapsedFrac = Math.min(1, Math.max(0, (now - startMs) / bookedMs));

  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = C * (overtime ? 1 : elapsedFrac);

  return (
    <div className="mt-5 flex items-center gap-5 rounded-2xl border border-border bg-surface p-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          <motion.circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={overtime ? "stroke-trust-strong" : "stroke-primary"}
            strokeDasharray={C}
            initial={false}
            animate={{ strokeDashoffset: C - dash }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular-nums text-2xl font-semibold tracking-tight">
            {mm}:{ss}
          </span>
          {!reduce && !overtime && (
            <motion.span
              className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary"
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">
          {overtime ? "Over the booked time" : "Walk in progress"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {overtime
            ? `Running ${mm}:${ss} past the ${Math.round(totalSec / 60)}-min booking.`
            : `${mm}:${ss} left of the ${Math.round(totalSec / 60)}-min booking.`}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Started {fmtTime(startMs)} · ends ~{fmtTime(endMs)}
        </p>
      </div>
    </div>
  );
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
