"use client";

import Link from "next/link";
import { Repeat } from "lucide-react";
import { Protected } from "../../components/auth/Protected";
import { ListSkeleton, BookingCardSkeleton } from "../../components/ui/Skeleton";
import { useBookings } from "../../hooks/useBookings";
import { routes } from "../../lib/paths";
import type { BookingStatus, BookingServiceType } from "../../lib/types";

const SERVICE_LABEL: Record<BookingServiceType, string> = {
  walk: "Walk",
  sit: "Sit",
  walk_sit: "Walk & Sit",
};

const STATUS_STYLE: Record<BookingStatus, string> = {
  requested: "bg-accent-subtle text-link",
  accepted: "bg-trust-subtle text-trust-strong",
  in_progress: "bg-trust-subtle text-trust-strong",
  completed: "bg-muted text-muted-foreground",
  declined: "bg-red-50 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-amber-50 text-amber-700",
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function BookingsInner() {
  const { data: bookings, isLoading } = useBookings();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display mb-6 text-3xl font-semibold">Bookings</h1>
      {isLoading ? (
        <ListSkeleton count={3}>
          <BookingCardSkeleton />
        </ListSkeleton>
      ) : !bookings || bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No bookings yet.
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={routes.booking(b.id)}
              className="lift block rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:bg-muted/40 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-medium">
                  {SERVICE_LABEL[b.serviceType]} {b.role === "walker" ? "for" : "with"} {b.counterpartName}
                  {b.seriesId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2 py-0.5 text-xs font-medium text-link">
                      <Repeat className="h-3 w-3" /> #{(b.seriesIndex ?? 0) + 1}
                    </span>
                  )}
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[b.status]}`}>
                  {b.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {fmt(b.startAt)}
                {b.quotedTotal != null && <> · {b.currency === "USD" ? "$" : ""}{Number(b.quotedTotal).toFixed(2)}</>}
              </p>
            </Link>
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
