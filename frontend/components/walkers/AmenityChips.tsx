"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, HeartPulse, Home, PawPrint, Sparkles } from "lucide-react";
import { AMENITY_GROUPS, AMENITY_LABEL } from "../../lib/amenities";

const GROUP_ICON: Record<string, typeof Home> = {
  care: HeartPulse,
  home: Home,
  pets: PawPrint,
  extras: Sparkles,
};

/**
 * Read-only amenity chips, grouped, for the walker profile.
 * Care skills render teal (trust) — they're safety signals; the rest neutral.
 */
export function AmenityList({ amenities }: { amenities: string[] }) {
  const owned = new Set(amenities);
  const groups = AMENITY_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => owned.has(i.id)),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div className="mt-6 space-y-4">
      <h2 className="font-display text-xl font-medium">Skills &amp; home</h2>
      {groups.map((g) => {
        const Icon = GROUP_ICON[g.id] ?? Sparkles;
        return (
          <div key={g.id}>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {g.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((i) => (
                <span
                  key={i.id}
                  className={`rounded-full px-3 py-1 text-xs ${
                    g.tone === "trust"
                      ? "bg-trust-subtle text-trust-strong"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i.label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Multi-select amenity picker — tap-to-toggle chips, grouped.
 * Used in walker onboarding and the discovery filter sheet (compact).
 */
export function AmenityPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const selected = new Set(value);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {AMENITY_GROUPS.map((g) => {
        const Icon = GROUP_ICON[g.id] ?? Sparkles;
        return (
          <div key={g.id}>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {g.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((i) => {
                const on = selected.has(i.id);
                return (
                  <motion.button
                    key={i.id}
                    type="button"
                    onClick={() => toggle(i.id)}
                    whileTap={reduce ? undefined : { scale: 0.94 }}
                    aria-pressed={on}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-surface text-foreground hover:bg-muted"
                    }`}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {i.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact selected-amenities summary, e.g. under a filter button. */
export function amenitySummary(ids: string[], max = 2): string {
  const labels = ids.map((id) => AMENITY_LABEL[id]).filter(Boolean);
  if (labels.length === 0) return "";
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}
