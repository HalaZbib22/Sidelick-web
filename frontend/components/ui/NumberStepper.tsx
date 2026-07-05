"use client";

import { Minus, Plus } from "lucide-react";

interface NumberStepperProps {
  label?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}

export function NumberStepper({ label, value, onChange, min = 1, max = 99 }: NumberStepperProps) {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition hover:bg-muted disabled:opacity-40";
  return (
    <div>
      {label && <label className="mb-1.5 block text-sm font-medium">{label}</label>}
      <div className="inline-flex items-center gap-3">
        <button type="button" aria-label="Decrease" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-6 text-center text-base font-medium">{value}</span>
        <button type="button" aria-label="Increase" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
