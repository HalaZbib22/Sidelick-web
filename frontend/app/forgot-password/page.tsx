"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AuthShell } from "../../components/auth/AuthShell";
import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";
import { useForm } from "../../hooks/useForm";
import { apiFetch } from "../../lib/api";
import { api, routes } from "../../lib/paths";
import { validateEmail } from "../../lib/validation";

interface Values {
  email: string;
}

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  const form = useForm<Values>({
    initialValues: { email: "" },
    validators: { email: (v) => validateEmail(v) },
    onError: (msg) => toast.error(msg),
    onSubmit: async (values) => {
      const data = await apiFetch<{ resetUrl?: string }>(api.forgotPassword, {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSent(true);
      if (data?.resetUrl) setDevUrl(data.resetUrl); // dev only
      toast.success("If an account exists, a reset link has been sent.");
    },
  });

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link."
      footer={
        <Link href={routes.signin} className="font-medium text-primary">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            If an account exists for that email, a reset link is on its way.
          </p>
          {devUrl && (
            <p className="break-all rounded-lg bg-muted p-3 text-xs">
              Dev reset link:{" "}
              <Link href={devUrl} className="text-primary underline">
                {devUrl}
              </Link>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.values.email}
            onChange={(e) => form.handleChange("email", e.target.value)}
            onBlur={() => form.handleBlur("email")}
            error={form.errors.email}
          />
          <Button type="submit" loading={form.isSubmitting} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
