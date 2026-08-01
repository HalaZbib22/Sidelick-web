"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "../../components/auth/AuthShell";
import { FormField } from "../../components/ui/FormField";
import { PasswordField } from "../../components/ui/PasswordField";
import { Button } from "../../components/ui/Button";
import { useForm } from "../../hooks/useForm";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";
import { api, routes } from "../../lib/paths";
import { validateEmail, validatePassword } from "../../lib/validation";

interface SignInValues {
  email: string;
  password: string;
}

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  // Persistent inline error for a rejected login (e.g. wrong password). A toast
  // alone auto-dismisses; this banner stays until the next attempt so the user
  // always sees why sign-in failed.
  const [authError, setAuthError] = useState<string | null>(null);
  // "Remember me": on → token persists across restarts (localStorage);
  // off → session-only (sessionStorage), cleared when the browser closes.
  const [remember, setRemember] = useState(true);

  const form = useForm<SignInValues>({
    initialValues: { email: "", password: "" },
    validators: {
      email: (v) => validateEmail(v),
      password: (v) => validatePassword(v),
    },
    onError: (msg) => {
      setAuthError(msg);
      toast.error(msg);
    },
    onSubmit: async (values) => {
      setAuthError(null);
      const { token } = await apiFetch<{ token: string }>(api.signin, {
        method: "POST",
        body: JSON.stringify(values),
      });
      signIn(token, remember);
      toast.success("Signed in successfully!");
      router.push(routes.dashboard);
    },
  });

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Sidelick account"
      footer={
        <>
          New here?{" "}
          <Link href={routes.signup} className="font-medium text-primary">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
        {authError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {authError}
          </div>
        )}
        <FormField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.values.email}
          onChange={(e) => form.handleChange("email", e.target.value)}
          onBlur={() => form.handleBlur("email")}
          error={form.errors.email}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={form.values.password}
          onChange={(e) => form.handleChange("password", e.target.value)}
          onBlur={() => form.handleBlur("password")}
          error={form.errors.password}
        />
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary accent-primary focus:ring-2 focus:ring-primary/40"
            />
            Remember me
          </label>
          <Link href={routes.forgotPassword} className="text-sm text-primary">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={form.isSubmitting} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
