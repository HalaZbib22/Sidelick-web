import { isValidPhoneNumber } from "libphonenumber-js";

/**
 * Reusable field validators. Rules must mirror the backend / schema.sql.
 * Frontend validation is for UX; the backend is the security boundary.
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

const ok: ValidationResult = { isValid: true };

export function validateName(value: string, label = "Name"): ValidationResult {
  const v = value.trim();
  if (!v) return { isValid: false, error: `${label} is required` };
  if (v.length > 100) return { isValid: false, error: `${label} must be under 100 characters` };
  if (!/[a-zA-Z؀-ۿ]/.test(v)) return { isValid: false, error: `${label} must contain letters` };
  return ok;
}

export function validateEmail(value: string): ValidationResult {
  const v = value.trim();
  if (!v) return { isValid: false, error: "Email is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { isValid: false, error: "Enter a valid email" };
  return ok;
}

export function validatePhone(value: string): ValidationResult {
  const v = value.trim();
  if (!v) return ok; // optional
  // value is expected in E.164 (PhoneField emits it); validate against real rules.
  return isValidPhoneNumber(v)
    ? ok
    : { isValid: false, error: "Enter a valid phone number" };
}

export function validatePassword(value: string): ValidationResult {
  if (!value) return { isValid: false, error: "Password is required" };
  if (value.length < 8) return { isValid: false, error: "Password must be at least 8 characters" };
  return ok;
}

export function validateBreed(value: string): ValidationResult {
  const v = value.trim();
  if (!v) return ok; // optional
  if (v.length > 50) return { isValid: false, error: "Breed must be under 50 characters" };
  if (!/[a-zA-Z؀-ۿ]/.test(v)) return { isValid: false, error: "Breed must contain letters" };
  return ok;
}

export function validateAge(value: string | number): ValidationResult {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return { isValid: false, error: "Age must be a number" };
  if (n < 0 || n > 30) return { isValid: false, error: "Age must be between 0 and 30" };
  return ok;
}
