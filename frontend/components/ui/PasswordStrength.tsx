"use client";

import { cn } from "../../lib/utils";

/** Returns a 0–4 strength score for a password. */
export function scorePassword(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const LABELS = ["Too weak", "Weak", "Okay", "Good", "Strong"];
const COLORS = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-lime-500", "bg-emerald-600"];

/** A single actionable suggestion for the weakest missing criterion. */
function hint(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters";
  if (!(/[A-Z]/.test(pw) && /[a-z]/.test(pw))) return "Mix upper and lower case";
  if (!(/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw))) return "Add a number and a symbol";
  if (pw.length < 12) return "Longer is stronger (12+)";
  return null;
}

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score = scorePassword(value);
  const tip = hint(value);
  return (
    <div className="space-y-1">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full", i < score ? COLORS[score] : "bg-muted")}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {LABELS[score]}
        {tip && <span className="text-muted-foreground/80"> · {tip}</span>}
      </p>
    </div>
  );
}
