"use client";

import { useId } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Label } from "./Label";
import { cn } from "../../lib/utils";

interface PhoneFieldProps {
  label: string;
  /** Stored value in E.164 form, e.g. "+9617XXXXXXX". */
  value: string;
  onChange: (e164: string) => void;
  error?: string;
  helperText?: string;
}

/** Phone field with a searchable country dropdown + per-country formatting
 *  (react-phone-number-input). Emits E.164. Themed to match our inputs. */
export function PhoneField({ label, value, onChange, error, helperText }: PhoneFieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className={cn("slk-phone", error && "slk-phone-error")}>
        <PhoneInput
          id={id}
          international
          defaultCountry="LB"
          placeholder="Phone number"
          value={value || undefined}
          onChange={(v) => onChange(v ?? "")}
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
