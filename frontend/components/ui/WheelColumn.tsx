"use client";

import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

export interface WheelOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * A single scroll-snapping wheel of options (iOS / MUI-mobile style). The
 * selected row sits in the centered highlight band; tap a row or scroll to it
 * to pick. Used to build the date/time popover without any third-party picker.
 */
export function WheelColumn({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: WheelOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ITEM = 36; // px row height — keep in sync with the styles below

  // Keep the selected row centered whenever the value changes externally.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const i = options.findIndex((o) => o.value === value);
    if (i >= 0) el.scrollTo({ top: i * ITEM, behavior: "smooth" });
  }, [value, options]);

  return (
    <div
      role="listbox"
      aria-label={ariaLabel}
      ref={ref}
      className="hide-scrollbar relative h-[180px] flex-1 snap-y snap-mandatory overflow-y-auto"
      style={{ scrollPaddingTop: ITEM * 2, paddingTop: ITEM * 2, paddingBottom: ITEM * 2 }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.value)}
            className={cn(
              "flex h-9 w-full snap-center items-center justify-center text-sm tabular-nums transition",
              selected ? "font-semibold text-foreground" : "text-muted-foreground",
              o.disabled ? "cursor-not-allowed opacity-30" : "hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
