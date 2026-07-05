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
  }
  const PhoneInput: React.FC<PhoneInputProps>;
  export default PhoneInput;
}
