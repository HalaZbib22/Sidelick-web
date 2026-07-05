"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "../../lib/utils";

interface StarRatingProps {
  /** Current value (0–5). */
  value: number;
  /** Omit to render a read-only display. */
  onChange?: (n: number) => void;
  /** Tailwind size classes for each star. */
  size?: string;
  className?: string;
  ariaLabel?: string;
}

const STARS = [1, 2, 3, 4, 5];

export function StarRating({
  value,
  onChange,
  size = "h-7 w-7",
  className,
  ariaLabel = "Rating",
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const readonly = !onChange;
  const shown = hover || value;

  if (readonly) {
    return (
      <span
        className={cn("inline-flex items-center gap-0.5", className)}
        role="img"
        aria-label={`${value} out of 5 stars`}
      >
        {STARS.map((n) => (
          <Star
            key={n}
            className={cn(
              size,
              n <= Math.round(value)
                ? "fill-primary text-primary"
                : "fill-none text-muted-foreground/40"
            )}
          />
        ))}
      </span>
    );
  }

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      role="radiogroup"
      aria-label={ariaLabel}
      onMouseLeave={() => setHover(0)}
    >
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className="rounded-md p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onClick={() => onChange(n)}
        >
          <Star
            className={cn(
              size,
              "transition-colors",
              n <= shown ? "fill-primary text-primary" : "fill-none text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}
