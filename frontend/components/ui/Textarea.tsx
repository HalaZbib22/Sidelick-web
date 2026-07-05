"use client";

import { useId } from "react";
import { cn } from "../../lib/utils";
import { Label } from "./Label";

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function TextareaField({ label, error, id, className, ...props }: TextareaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId}>{label}</Label>
      <textarea
        id={fieldId}
        className={cn(
          "min-h-20 w-full rounded-xl border bg-surface px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-primary/40",
          error ? "border-red-500 focus:ring-red-500/30" : "border-border",
          className
        )}
        {...props}
      />
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
