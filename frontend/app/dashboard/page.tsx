"use client";

import Link from "next/link";
import {
  PawPrint,
  CalendarDays,
  Wallet,
  CheckCircle2,
  Inbox,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Protected } from "../../components/auth/Protected";
import { Skeleton } from "../../components/ui/Skeleton";
import { useMe } from "../../hooks/useMe";
import { useBookings } from "../../hooks/useBookings";
import { usePets } from "../../hooks/usePets";
import { routes } from "../../lib/paths";
import { cn } from "../../lib/utils";
import type {
  Me,
  BookingSummary,
  BookingServiceType,
  BookingStatus,
} from "../../lib/types";

/* ------------------------------- helpers ------------------------------- */

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const SERVICE_LABEL: Record<BookingServiceType, string> = {
  walk: "Dog walk",
  sit: "Sitting",
  walk_sit: "Walk + sitting",
};

const ACTIVE: BookingStatus[] = ["requested", "accepted", "in_progress"];

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-100 text-amber-800",
  accepted: "bg-trust-subtle text-trust-strong",
  in_progress: "bg-accent-subtle text-link",
  completed: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  accepted: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

const byStart = (a: BookingSummary, b: BookingSummary) =>
  +new Date(a.startAt) - +new Date(b.startAt);

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/* ------------------------------ primitives ----------------------------- */

function Hero({ name, sub }: { name: string; sub: string }) {
  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return (
    <header className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-subtle/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-trust-subtle/60 blur-3xl" />
      <div className="relative">
        <p className="text-sm text-muted-foreground">{today}</p>
        <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">
          {greeting()}, {name}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{sub}</p>
      </div>
    </header>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
  tone = "accent",
}: {
  icon: typeof PawPrint;
  value: string;
  label: string;
  tone?: "accent" | "trust" | "primary";
}) {
  const toneCls =
    tone === "trust"
      ? "bg-trust-subtle text-trust-strong"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-accent-subtle text-link";
  return (
    <div className="lift rounded-2xl border border-border bg-surface p-4 shadow-sm hover:shadow-md">
      <span className={cn("mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full", toneCls)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-display text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function NextUp({ b }: { b: BookingSummary }) {
  return (
    <Link
      href={routes.booking(b.id)}
      className="lift block rounded-2xl border border-border bg-surface p-5 shadow-md transition hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next up</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_STYLE[b.status] ?? "bg-muted text-muted-foreground"
          )}
        >
          {STATUS_LABEL[b.status] ?? b.status}
        </span>
      </div>
      <p className="font-display mt-2 text-xl font-semibold">{SERVICE_LABEL[b.serviceType]}</p>
      <p className="text-sm text-muted-foreground">with {b.counterpartName}</p>
      <div className="mt-3 flex items-center gap-1.5 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{fmtWhen(b.startAt)}</span>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-link">
        View details <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: typeof PawPrint;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="lift flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:shadow-md"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-link">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center shadow-sm">
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

/* ------------------------------- owner --------------------------------- */

function FindWalkerCta() {
  return (
    <Link
      href={routes.walkers}
      className="lift group relative block overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-glow"
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
            <Sparkles className="h-3.5 w-3.5" /> Book care
          </p>
          <p className="font-display mt-1 text-2xl font-semibold">Find a walker near you</p>
          <p className="mt-1 text-sm text-primary-foreground/85">
            Verified walkers &amp; sitters, sorted by distance.
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 transition group-hover:bg-white/25">
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}

function OwnerDashboard() {
  const { data: bookings, isLoading: bLoading } = useBookings();
  const { data: pets, isLoading: pLoading } = usePets();

  const list = bookings ?? [];
  const upcoming = list.filter((b) => ACTIVE.includes(b.status)).sort(byStart);
  const completed = list.filter((b) => b.status === "completed");
  const nextUp = upcoming[0];
  const petCount = pets?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={PawPrint} value={pLoading ? "—" : String(petCount)} label={petCount === 1 ? "Pet" : "Pets"} />
        <StatTile icon={CalendarDays} value={bLoading ? "—" : String(upcoming.length)} label="Upcoming" tone="trust" />
        <StatTile icon={CheckCircle2} value={bLoading ? "—" : String(completed.length)} label="Completed" tone="primary" />
      </div>

      <FindWalkerCta />

      {bLoading ? (
        <Skeleton className="h-44 w-full rounded-2xl" />
      ) : nextUp ? (
        <NextUp b={nextUp} />
      ) : null}

      <div>
        <h2 className="font-display mb-3 text-lg font-semibold">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickAction
            href={routes.pets}
            icon={PawPrint}
            title="Manage my pets"
            subtitle={petCount ? `${petCount} on file` : "Add your first dog"}
          />
          <QuickAction
            href={routes.bookings}
            icon={CalendarDays}
            title="My bookings"
            subtitle={upcoming.length ? `${upcoming.length} upcoming` : "View history"}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ walker --------------------------------- */

function WalkerVerified() {
  const { data: bookings, isLoading } = useBookings();
  const list = bookings ?? [];
  const requests = list.filter((b) => b.status === "requested");
  const upcoming = list
    .filter((b) => b.status === "accepted" || b.status === "in_progress")
    .sort(byStart);
  const completed = list.filter((b) => b.status === "completed");
  const nextUp = [...requests, ...upcoming].sort(byStart)[0];

  const now = new Date();
  const thisMonth = completed.filter((b) => {
    const d = new Date(b.startAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const earnCurrency = thisMonth[0]?.currency ?? "USD";
  const earnTotal = thisMonth.reduce((s, b) => s + Number(b.quotedTotal ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={Inbox} value={isLoading ? "—" : String(requests.length)} label="Requests" tone="primary" />
        <StatTile icon={CalendarDays} value={isLoading ? "—" : String(upcoming.length)} label="Upcoming" tone="trust" />
        <StatTile icon={Wallet} value={isLoading ? "—" : money(earnTotal, earnCurrency)} label="This month" />
      </div>

      {isLoading ? (
        <Skeleton className="h-44 w-full rounded-2xl" />
      ) : nextUp ? (
        <NextUp b={nextUp} />
      ) : (
        <EmptyState
          title="You're all set"
          body="No active requests right now. New bookings will show up here."
        />
      )}

      <div>
        <h2 className="font-display mb-3 text-lg font-semibold">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickAction
            href={routes.bookings}
            icon={Inbox}
            title="Requests & bookings"
            subtitle={requests.length ? `${requests.length} waiting` : "View all"}
          />
          <QuickAction href={routes.profile} icon={ShieldCheck} title="My profile" subtitle="Verified walker" />
        </div>
      </div>
    </div>
  );
}

function WalkerPending() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-trust-subtle p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-trust-strong/10 text-trust-strong">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-trust-strong">
              Your application is under review
            </h2>
            <p className="mt-1 text-sm text-trust-strong/90">
              We usually verify within 24–48 hours. Keep editing your profile meanwhile — you&apos;ll
              appear to owners and can accept bookings the moment you&apos;re verified.
            </p>
          </div>
        </div>
      </div>
      <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-medium text-muted-foreground">
        <ShieldAlert className="h-4 w-4" /> Go online (locked until verified)
      </span>
    </div>
  );
}

function WalkerRejected() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
            <ShieldAlert className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-red-700">
              Verification was not approved
            </h2>
            <p className="mt-1 text-sm text-red-700/90">
              Please resubmit a clear photo of your ID so we can match it to your selfie.
            </p>
          </div>
        </div>
      </div>
      <Link
        href={routes.onboarding}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
      >
        Resubmit ID <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function WalkerUnverified() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
      <p className="font-display text-lg font-semibold">Finish setting up your profile</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Complete onboarding and get verified to start accepting bookings.
      </p>
      <Link
        href={routes.onboarding}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90"
      >
        Complete onboarding <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

/* ------------------------------- shell --------------------------------- */

function subFor(me: Me): string {
  if (me.role === "admin") return "Jump into the admin portal to review the queue.";
  if (me.role === "walker") {
    if (me.verificationStatus === "verified") return "Here's your walk activity at a glance.";
    if (me.verificationStatus === "pending") return "You're almost ready to start walking.";
    if (me.verificationStatus === "rejected") return "One quick fix and you'll be back on track.";
    return "A few steps left to start accepting bookings.";
  }
  return "Everything for your dogs, in one place.";
}

function WalkerBody({ me }: { me: Me }) {
  switch (me.verificationStatus) {
    case "verified":
      return <WalkerVerified />;
    case "pending":
      return <WalkerPending />;
    case "rejected":
      return <WalkerRejected />;
    default:
      return <WalkerUnverified />;
  }
}

function DashboardInner() {
  const { data: me, isLoading } = useMe();

  if (isLoading || !me) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="mb-8 h-36 w-full rounded-3xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="mt-6 h-32 w-full rounded-3xl" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Hero name={me.firstName} sub={subFor(me)} />

      {me.role === "walker" ? (
        <WalkerBody me={me} />
      ) : me.role === "admin" ? (
        <Link
          href={routes.admin}
          className="lift inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90"
        >
          Go to admin portal <ArrowRight className="h-4 w-4" />
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
