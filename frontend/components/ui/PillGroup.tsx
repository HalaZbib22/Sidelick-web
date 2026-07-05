"use client";

import { cn } from "../../lib/utils";

interface PillGroupProps<T extends string> {
  label?: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
}

export function PillGroup<T extends string>({ label, options, value, onChange }: PillGroupProps<T>) {
  return (
    <div>
      {label && <label className="mb-1.5 block text-sm font-medium">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-3.5 py-2 text-xs font-medium transition",
              value === o.value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-link hover:bg-muted"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
