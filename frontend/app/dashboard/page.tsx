"use client";

import Link from "next/link";
import { Protected } from "../../components/auth/Protected";
import { Skeleton } from "../../components/ui/Skeleton";
import { useMe } from "../../hooks/useMe";
import { routes } from "../../lib/paths";
import type { VerificationStatus } from "../../lib/types";

function OwnerDashboard() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Find care for your dog</h2>
        <p className="text-sm text-muted-foreground">
          Nearby walkers &amp; sitters and your bookings will appear here.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={routes.walkers}
          className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Find a walker
        </Link>
        <Link
          href={routes.pets}
          className="inline-block rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Manage my pets
        </Link>
        <Link
          href={routes.bookings}
          className="inline-block rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          My bookings
        </Link>
      </div>
    </section>
  );
}

function WalkerView({ status }: { status: VerificationStatus }) {
  if (status === "verified") {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Your walks &amp; bookings</h2>
          <p className="text-sm text-muted-foreground">
            Incoming requests, upcoming bookings, earnings, and your streak will appear here.
          </p>
        </div>
        <Link
          href={routes.bookings}
          className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          View requests &amp; bookings
        </Link>
      </section>
    );
  }
  if (status === "pending") {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl bg-trust-subtle p-5">
          <h2 className="font-medium text-trust-strong">Your application is under review</h2>
          <p className="mt-1 text-sm text-trust-strong/90">We usually verify within 24–48 hours.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          You can keep editing your profile. You&apos;ll appear to pet owners and can accept bookings
          as soon as you&apos;re verified.
        </p>
        <span className="inline-block cursor-not-allowed rounded-xl bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
          Go online (locked until verified)
        </span>
      </section>
    );
  }
  if (status === "rejected") {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl bg-red-50 p-5">
          <h2 className="font-medium text-red-700">Verification was not approved</h2>
          <p className="mt-1 text-sm text-red-700/90">Please resubmit a clear photo of your ID.</p>
        </div>
        <Link href={routes.onboarding} className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Resubmit
        </Link>
      </section>
    );
  }
  // unverified — hasn't finished onboarding
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">Finish setting up your walker profile to get verified.</p>
      <Link href={routes.onboarding} className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        Complete onboarding
      </Link>
    </section>
  );
}

function DashboardInner() {
  const { data: me, isLoading } = useMe();

  if (isLoading || !me) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-72" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  const roleLabel =
    me.role === "walker" ? "Walker / Sitter" : me.role === "admin" ? "Admin" : "Pet owner";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Signed in as {roleLabel}</p>
      </header>

      {me.role === "walker" ? (
        <WalkerView status={me.verificationStatus} />
      ) : me.role === "admin" ? (
        <Link href={routes.admin} className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Go to admin portal
        </Link>
      ) : (
        <OwnerDashboard />
      )}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Protected>
      <DashboardInner />
    </Protected>
  );
}
