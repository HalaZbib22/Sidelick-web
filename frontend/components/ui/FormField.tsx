"use client";

import { useId } from "react";
import { Label } from "./Label";
import { Input } from "./Input";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/** Label + input + accessible inline error. */
export function FormField({ label, error, id, ...inputProps }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
