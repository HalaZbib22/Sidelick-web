import { ApiError } from "./api";

/**
 * Shape of the `errors` payload the backend attaches on validation failure.
 * Matches zod's `flatten()` output (see backend response usage).
 */
interface FlattenedErrors {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
}

/**
 * Map server-side field errors onto a form's error state.
 * Returns the field-error object so callers can merge it in.
 */
export function serverFieldErrors<T extends string>(
  err: unknown
): Partial<Record<T, string>> {
  const out: Partial<Record<T, string>> = {};
  if (err instanceof ApiError && err.errors && typeof err.errors === "object") {
    const fieldErrors = (err.errors as FlattenedErrors).fieldErrors;
    if (fieldErrors) {
      for (const [key, msgs] of Object.entries(fieldErrors)) {
        if (msgs && msgs.length) out[key as T] = msgs[0];
      }
    }
  }
  return out;
}

/** Human-readable message for any thrown error (for toasts). */
export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
