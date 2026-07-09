"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";

import dogWalk from "../../public/lottie/dog-walk.json";
import dogSit from "../../public/lottie/dog-sit.json";

// lottie-web touches window/document, so load it client-side only.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * Live walk/sit progress shown while a booking is in_progress.
 * Target = actualStartAt + the booked duration (scheduled endAt - startAt).
 * A little dog trots along the path as time elapses; when the booked duration
 * is up it reaches the finish line and sits proudly by the bone. Honors
 * reduced-motion (the dog is shown as a still frame).
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

  const animate = !reduce;
  // Dog centre travels between these two % marks so it never clips the edges.
  const pct = overtime ? 90 : 7 + elapsedFrac * 82;
  const fillPct = overtime ? 100 : pct;
  // Pawprints already passed by the dog.
  const prints = [20, 36, 52, 68].filter((p) => p < pct - 4);

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface p-5">
      <style>{keyframes}</style>

      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              overtime ? "bg-trust-strong" : "bg-primary"
            } ${animate && !overtime ? "wc-pulse" : ""}`}
            aria-hidden="true"
          />
          <p className="text-sm font-medium">
            {overtime ? "All done — good walk!" : "Walk in progress"}
          </p>
        </div>
        <span
          className={`tabular-nums text-3xl font-semibold tracking-tight ${
            overtime ? "text-trust-strong" : "text-foreground"
          }`}
        >
          {overtime && "+"}
          {mm}:{ss}
        </span>
      </div>

      {/* The path */}
      <div className="relative mt-4 h-[96px]">
        {/* Track + filled trail */}
        <div className="absolute inset-x-1 bottom-4 h-2.5 rounded-full bg-muted">
          <motion.div
            className={`h-full rounded-full ${
              overtime ? "bg-trust-strong" : "bg-primary"
            }`}
            initial={false}
            animate={{ width: `${fillPct}%` }}
            transition={
              reduce ? { duration: 0 } : { duration: 1, ease: "linear" }
            }
          />
        </div>

        {/* Pawprints left behind on the trail */}
        {prints.map((p) => (
          <svg
            key={p}
            viewBox="0 0 12 10"
            className="absolute bottom-[9px] h-2 w-2.5 text-primary/30"
            style={{ left: `${p}%`, transform: "translateX(-50%)" }}
            fill="currentColor"
            aria-hidden="true"
          >
            <ellipse cx="6" cy="7" rx="2.6" ry="2" />
            <circle cx="2.5" cy="3" r="1.2" />
            <circle cx="6" cy="2" r="1.2" />
            <circle cx="9.5" cy="3" r="1.2" />
          </svg>
        ))}

        {/* Bone at the finish — sits on the track, just inside the end */}
        <div className="absolute bottom-[11px] right-1">
          <svg
            viewBox="0 0 24 20"
            className={`h-5 w-5 ${
              overtime ? "text-primary/60" : "text-muted-foreground/40"
            }`}
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="7" r="3" />
            <circle cx="5" cy="13" r="3" />
            <circle cx="19" cy="7" r="3" />
            <circle cx="19" cy="13" r="3" />
            <rect x="5" y="8" width="14" height="4" />
          </svg>
        </div>

        {/* The dog — walks the trail, then sits at the finish line */}
        <motion.div
          className="absolute bottom-[9px]"
          style={{ transform: "translateX(-50%)" }}
          initial={false}
          animate={{ left: `${pct}%` }}
          transition={
            reduce ? { duration: 0 } : { duration: 1, ease: "linear" }
          }
          aria-hidden="true"
        >
          {overtime ? (
            <Lottie
              animationData={dogSit}
              loop={animate}
              autoplay={animate}
              className="h-[62px] w-[62px]"
              rendererSettings={{ preserveAspectRatio: "xMidYMax meet" }}
            />
          ) : (
            <Lottie
              animationData={dogWalk}
              loop={animate}
              autoplay={animate}
              className="h-[58px] w-[72px]"
              rendererSettings={{ preserveAspectRatio: "xMidYMax meet" }}
            />
          )}
        </motion.div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {overtime
          ? `Ran ${mm}:${ss} past the ${Math.round(
              totalSec / 60
            )}-min booking · started ${fmtTime(startMs)}`
          : `${Math.round(totalSec / 60)}-min booking · started ${fmtTime(
              startMs
            )} · ends ~${fmtTime(endMs)}`}
      </p>
    </div>
  );
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const keyframes = `
@keyframes wc-pulse { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
.wc-pulse { animation: wc-pulse 1.4s ease-in-out infinite }
`;
