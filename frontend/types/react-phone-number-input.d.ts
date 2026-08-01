declare module "react-phone-number-input" {
  import * as React from "react";
  export interface PhoneInputProps {
    value?: string;
    onChange: (value?: string) => void;
    defaultCountry?: string;
    international?: boolean;
    placeholder?: string;
    id?: string;
    className?: string;
    disabled?: boolean;
    /** Per-country flag components (bundled inline SVGs — no external CDN). */
    flags?: Record<string, React.ComponentType<{ title?: string }>>;
  }
  const PhoneInput: React.FC<PhoneInputProps>;
  export default PhoneInput;
}

declare module "react-phone-number-input/flags" {
  import * as React from "react";
  const flags: Record<string, React.ComponentType<{ title?: string }>>;
  export default flags;
}
