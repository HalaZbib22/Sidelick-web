"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "../../components/auth/AuthShell";
import { PasswordField } from "../../components/ui/PasswordField";
import { Button } from "../../components/ui/Button";
import { PasswordStrength } from "../../components/ui/PasswordStrength";
import { useForm } from "../../hooks/useForm";
import { apiFetch } from "../../lib/api";
import { api, routes } from "../../lib/paths";
import { validatePassword } from "../../lib/validation";

interface Values {
  password: string;
  confirmPassword: string;
}

function ResetInner() {
  const router = useRouter();
  const token = useSearchParams().get("token");

  const form = useForm<Values>({
    initialValues: { password: "", confirmPassword: "" },
    validators: {
      password: (v) => validatePassword(v),
      confirmPassword: (v, all) =>
        v !== all.password
          ? { isValid: false, error: "Passwords do not match" }
          : { isValid: true },
    },
    onError: (msg) => toast.error(msg),
    onSubmit: async (values) => {
      await apiFetch(api.resetPassword, {
        method: "POST",
        body: JSON.stringify({ token, password: values.password }),
      });
      toast.success("Password reset successfully!");
      setTimeout(() => router.push(routes.signin), 1200);
    },
  });

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="This reset link is missing or invalid.">
        <Link href={routes.forgotPassword} className="font-medium text-primary">
          Request a new reset link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      footer={
        <Link href={routes.signin} className="font-medium text-primary">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
        <div>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            helperText="Use at least 8 characters."
            placeholder="Create a new password"
            value={form.values.password}
            onChange={(e) => form.handleChange("password", e.target.value)}
            onBlur={() => form.handleBlur("password")}
            error={form.errors.password}
          />
          <div className="mt-2">
            <PasswordStrength value={form.values.password} />
          </div>
        </div>
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          placeholder="Re-enter new password"
          value={form.values.confirmPassword}
          onChange={(e) => form.handleChange("confirmPassword", e.target.value)}
          onBlur={() => form.handleBlur("confirmPassword")}
          error={form.errors.confirmPassword}
        />
        <Button type="submit" loading={form.isSubmitting} className="w-full">
          Reset password
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
