"use client";

import { forwardRef } from "react";
import { cn } from "../../lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border bg-surface px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/40",
        invalid ? "border-red-500 focus:ring-red-500/30" : "border-border",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
