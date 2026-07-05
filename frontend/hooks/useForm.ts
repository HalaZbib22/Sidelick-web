"use client";

import { useCallback, useState } from "react";
import type { ValidationResult } from "../lib/validation";
import { serverFieldErrors, getApiErrorMessage } from "../lib/forms";

type Validators<T> = {
  [K in keyof T]?: (value: T[K], all: T) => ValidationResult;
};

type Errors<T> = Partial<Record<keyof T, string>>;
type Touched<T> = Partial<Record<keyof T, boolean>>;

interface UseFormOptions<T> {
  initialValues: T;
  validators?: Validators<T>;
  /** Async submit. Throw ApiError to surface server-side field errors + toast. */
  onSubmit: (values: T) => Promise<void>;
  /** Called with a user-friendly message when submit throws. */
  onError?: (message: string) => void;
}

/**
 * Small, dependency-free form hook: values, per-field validation on
 * change/blur/submit, server field-error mapping, and submit lifecycle.
 */
export function useForm<T extends object>(opts: UseFormOptions<T>) {
  const { initialValues, onSubmit, onError } = opts;
  const validators = (opts.validators ?? {}) as Validators<T>;
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [touched, setTouched] = useState<Touched<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = useCallback(
    (name: keyof T, value: T[keyof T], all: T): string | undefined => {
      const validator = validators[name];
      if (!validator) return undefined;
      const result = validator(value, all);
      return result.isValid ? undefined : result.error;
    },
    [validators]
  );

  const handleChange = useCallback(
    (name: keyof T, value: T[keyof T]) => {
      setValues((prev) => {
        const next = { ...prev, [name]: value } as T;
        // Re-validate only if the field already showed an error (avoid nagging while typing).
        if (touched[name] || errors[name]) {
          setErrors((e) => ({ ...e, [name]: validateField(name, value, next) }));
        }
        return next;
      });
    },
    [touched, errors, validateField]
  );

  const handleBlur = useCallback(
    (name: keyof T) => {
      setTouched((t) => ({ ...t, [name]: true }));
      setErrors((e) => ({ ...e, [name]: validateField(name, values[name], values) }));
    },
    [values, validateField]
  );

  const validateAll = useCallback((): boolean => {
    const next: Errors<T> = {};
    let valid = true;
    for (const key of Object.keys(values) as (keyof T)[]) {
      const msg = validateField(key, values[key], values);
      if (msg) {
        next[key] = msg;
        valid = false;
      }
    }
    setErrors(next);
    setTouched(
      Object.keys(values).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Touched<T>)
    );
    return valid;
  }, [values, validateField]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!validateAll()) return;
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (err) {
        // Map server field errors inline, surface a toast message for the rest.
        const fieldErrs = serverFieldErrors<keyof T & string>(err);
        if (Object.keys(fieldErrs).length) {
          setErrors((prev) => ({ ...prev, ...fieldErrs }));
        }
        onError?.(getApiErrorMessage(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [validateAll, onSubmit, values, onError]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    setErrors,
    setValues,
  };
}
