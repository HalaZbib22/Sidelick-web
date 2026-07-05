"use client";

import { forwardRef } from "react";
import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border bg-surface px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40",
        invalid ? "border-red-500 focus:ring-red-500/30" : "border-border",
        className
      )}
      {...props}
    />
  );
});
