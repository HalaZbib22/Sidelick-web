"use client";

import { useId } from "react";
import { Label } from "./Label";
import { Select } from "./Select";

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export function SelectField({
  label,
  error,
  options,
  placeholder,
  id,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="space-y-1">
      <Label htmlFor={fieldId}>{label}</Label>
      <Select
        id={fieldId}
        invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...selectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
