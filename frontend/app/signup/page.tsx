"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "../../components/auth/AuthShell";
import { FormField } from "../../components/ui/FormField";
import { PhoneField } from "../../components/ui/PhoneField";
import { PasswordField } from "../../components/ui/PasswordField";
import { Button } from "../../components/ui/Button";
import { PasswordStrength } from "../../components/ui/PasswordStrength";
import { cn } from "../../lib/utils";
import { useForm } from "../../hooks/useForm";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";
import { api, routes } from "../../lib/paths";
import {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
} from "../../lib/validation";

type Role = "user" | "walker";

interface SignUpValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

function SignUpInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();
  const [role, setRole] = useState<Role>(params.get("role") === "walker" ? "walker" : "user");

  const form = useForm<SignUpValues>({
    initialValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      firstName: (v) => validateName(v, "First name"),
      lastName: (v) => validateName(v, "Last name"),
      email: (v) => validateEmail(v),
      phone: (v) => validatePhone(v),
      password: (v) => validatePassword(v),
      confirmPassword: (v, all) =>
        v !== all.password
          ? { isValid: false, error: "Passwords do not match" }
          : { isValid: true },
    },
    onError: (msg) => toast.error(msg),
    onSubmit: async (values) => {
      const { token } = await apiFetch<{ token: string }>(api.signup, {
        method: "POST",
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone || undefined,
          password: values.password,
          role,
        }),
      });
      signIn(token);
      toast.success("Account created successfully!");
      router.push(routes.onboarding);
    },
  });

  return (
    <AuthShell
      title="Create your account"
      subtitle="Walks, daycare, and travel sitting — one trusted app."
      footer={
        <>
          Already have an account?{" "}
          <Link href={routes.signin} className="font-medium text-primary">
            Sign in
          </Link>
        </>
      }
    >
      {/* Role selector */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        {(["user", "walker"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={cn(
              "rounded-lg py-2 text-sm font-medium transition",
              role === r ? "bg-background shadow-sm" : "text-muted-foreground"
            )}
          >
            {r === "user" ? "Pet owner" : "Walker / Sitter"}
          </button>
        ))}
      </div>

      <form onSubmit={form.handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="First name"
            name="firstName"
            autoComplete="given-name"
            placeholder="e.g. Hala"
            value={form.values.firstName}
            onChange={(e) => form.handleChange("firstName", e.target.value)}
            onBlur={() => form.handleBlur("firstName")}
            error={form.errors.firstName}
          />
          <FormField
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            placeholder="e.g. Khoury"
            value={form.values.lastName}
            onChange={(e) => form.handleChange("lastName", e.target.value)}
            onBlur={() => form.handleBlur("lastName")}
            error={form.errors.lastName}
          />
        </div>
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
        <PhoneField
          label="Phone (optional)"
          value={form.values.phone}
          onChange={(v) => form.handleChange("phone", v)}
          error={form.errors.phone}
        />
        <div>
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            helperText="Use at least 8 characters."
            placeholder="Create a password"
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
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Re-enter password"
          value={form.values.confirmPassword}
          onChange={(e) => form.handleChange("confirmPassword", e.target.value)}
          onBlur={() => form.handleBlur("confirmPassword")}
          error={form.errors.confirmPassword}
        />
        <Button type="submit" loading={form.isSubmitting} className="w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpInner />
    </Suspense>
  );
}
