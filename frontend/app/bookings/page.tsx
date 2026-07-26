"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Repeat } from "lucide-react";
import { Protected } from "../../components/auth/Protected";
import { ListSkeleton, BookingCardSkeleton } from "../../components/ui/Skeleton";
import { useBookings } from "../../hooks/useBookings";
import { routes } from "../../lib/paths";
import { SERVICE_CHIP, SERVICE_ICON, SERVICE_LABEL } from "../../lib/services";
import type { BookingStatus, BookingSummary } from "../../lib/types";

const STATUS_STYLE: Record<BookingStatus, string> = {
  requested: "bg-accent-subtle text-link",
  accepted: "bg-trust-subtle text-trust-strong",
  in_progress: "bg-trust-subtle text-trust-strong",
  completed: "bg-muted text-muted-foreground",
  declined: "bg-danger/10 text-danger",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-warning/10 text-warning",
};

/** Statuses that still need attention / are ahead of us. */
const ACTIVE: ReadonlySet<BookingStatus> = new Set([
  "requested",
  "accepted",
  "in_progress",
]);

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (sameDay(d, today)) return `Today · ${time}`;
  if (sameDay(d, tomorrow)) return `Tomorrow · ${time}`;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(b: BookingSummary): string | null {
  if (b.quotedTotal == null) return null;
  const n = Number(b.quotedTotal);
  return `${b.currency === "USD" ? "$" : `${b.currency} `}${n.toFixed(2)}`;
}

function BookingCard({ b, index }: { b: BookingSummary; index: number }) {
  const Icon = SERVICE_ICON[b.serviceType];
  return (
    <Link
      href={routes.booking(b.id)}
      className="slk-rise lift flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:shadow-md"
      style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${SERVICE_CHIP[b.serviceType]}`}
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium">
          <span className="truncate">
            {SERVICE_LABEL[b.serviceType]} {b.role === "walker" ? "for" : "with"}{" "}
            {b.counterpartName}
          </span>
          {b.seriesId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2 py-0.5 text-[10px] font-medium text-link">
              <Repeat className="h-3 w-3" /> #{(b.seriesIndex ?? 0) + 1}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fmtWhen(b.startAt)}
          {money(b) && (
            <>
              {" · "}
              <span className="font-medium text-foreground">{money(b)}</span>
            </>
          )}
        </p>
      </div>

      <span
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[b.status]}`}
      >
        {b.status === "in_progress" && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-trust opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-trust" />
          </span>
        )}
        {b.status.replace("_", " ")}
      </span>
    </Link>
  );
}

function EmptyTab({ upcoming }: { upcoming: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center shadow-sm">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-subtle to-trust-subtle">
        <CalendarDays className="h-6 w-6 text-primary" />
      </span>
      <p className="font-display mt-4 text-lg font-semibold">
        {upcoming ? "Nothing coming up" : "No past bookings yet"}
      </p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
        {upcoming
          ? "Book a walk, daycare, boarding, or drop-in and it'll show up here."
          : "Completed and past bookings will appear here."}
      </p>
      {upcoming && (
        <Link
          href={routes.walkers}
          className="lift mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90"
        >
          Find a walker
        </Link>
      )}
    </div>
  );
}

function BookingsInner() {
  const { data: bookings, isLoading } = useBookings();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const { upcoming, past } = useMemo(() => {
    const all = bookings ?? [];
    const upcoming = all
      .filter((b) => ACTIVE.has(b.status))
      .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
    const past = all
      .filter((b) => !ACTIVE.has(b.status))
      .sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt));
    return { upcoming, past };
  }, [bookings]);

  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      {/* Ambient hero band */}
      <header className="relative mb-5 overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-accent-subtle/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-trust-subtle/60 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Schedule
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold sm:text-4xl">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {upcoming.length > 0
              ? `${upcoming.length} upcoming · next ${fmtWhen(upcoming[0].startAt)}`
              : "Every walk, daycare and sitting in one place"}
          </p>
        </div>
      </header>

      {/* Upcoming / Past segmented control */}
      <div
        role="tablist"
        aria-label="Booking history"
        className="mb-5 grid grid-cols-2 gap-1 rounded-full border border-border bg-surface p-1 shadow-sm"
      >
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t} ({t === "upcoming" ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton count={3}>
          <BookingCardSkeleton />
        </ListSkeleton>
      ) : shown.length === 0 ? (
        <EmptyTab upcoming={tab === "upcoming"} />
      ) : (
        <div className="space-y-3">
          {shown.map((b, i) => (
            <BookingCard key={b.id} b={b} index={i} />
          ))}
        </div>
      )}
    </main>
  );
}

export default function BookingsPage() {
  return (
    <Protected>
      <BookingsInner />
    </Protected>
  );
}
