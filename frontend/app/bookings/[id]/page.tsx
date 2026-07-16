"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Protected } from "../../../components/auth/Protected";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { WalkCountdown } from "../../../components/bookings/WalkCountdown";
import { WalkPhotoCapture } from "../../../components/bookings/WalkPhotoCapture";
import { WalkPhotos } from "../../../components/bookings/WalkPhotos";
import { BookingReviewSection } from "../../../components/reviews/BookingReviewSection";
import { DisputeSection } from "../../../components/bookings/DisputeSection";
import { DeclineDialog } from "../../../components/bookings/DeclineDialog";
import { PaymentSection } from "../../../components/payments/PaymentSection";
import { useBooking, useBookingAction, useWalkPhotoAction } from "../../../hooks/useBookings";
import { routes } from "../../../lib/paths";
import { getApiErrorMessage } from "../../../lib/forms";
import { cn } from "../../../lib/utils";

const money = (cur: string, n: number) => (cur === "USD" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${cur}`);
const fmt = (dt: string) =>
  new Date(dt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const time = (dt: string) =>
  new Date(dt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const durationMins = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

// Keep in sync with the backend start-window gate (bookings.ts).
const START_EARLY_GRACE_MIN = 15;
const START_LATE_GRACE_MIN = 30;

type StartWindow = { canStart: boolean; hint: string | null };
function startWindow(startAt: string): StartWindow {
  const scheduled = new Date(startAt).getTime();
  const now = Date.now();
  if (now < scheduled - START_EARLY_GRACE_MIN * 60_000) {
    const opensAt = new Date(scheduled - START_EARLY_GRACE_MIN * 60_000);
    return { canStart: false, hint: `You can start at ${time(opensAt.toISOString())}` };
  }
  if (now > scheduled + START_LATE_GRACE_MIN * 60_000) {
    return { canStart: false, hint: "The start window has passed — ask the owner to cancel for a refund." };
  }
  return { canStart: true, hint: null };
}

type Capture = "start" | "mid" | "complete" | null;

function BookingInner() {
  const id = useParams<{ id: string }>().id;
  const { data: b, isLoading } = useBooking(id);
  const action = useBookingAction(id);
  const startWalk = useWalkPhotoAction(id, "start");
  const midPhoto = useWalkPhotoAction(id, "photo");
  const completeWalk = useWalkPhotoAction(id, "complete");
  const [capture, setCapture] = useState<Capture>(null);
  const [declining, setDeclining] = useState(false);

  const run = (a: "accept" | "cancel", label: string) =>
    action.mutate(a, { onSuccess: () => toast.success(label), onError: (e) => toast.error(getApiErrorMessage(e)) });

  const submitPhoto = (mutation: typeof startWalk, file: File, label: string) =>
    mutation.mutate(file, {
      onSuccess: () => {
        toast.success(label);
        setCapture(null);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });

  if (isLoading || !b) {
    return (
      <main className="mx-auto max-w-xl px-6 py-8">
        <Skeleton className="mb-6 h-4 w-28" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="mt-5 h-20 w-full rounded-2xl" />
        <Skeleton className="mt-4 h-28 w-full rounded-2xl" />
      </main>
    );
  }

  const isWalker = b.role === "walker";
  const pending = action.isPending;

  return (
    <main className="mx-auto max-w-xl px-6 py-8">
      <Link href={routes.bookings} className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">
          {isWalker ? "Request from" : "Booking with"} {b.counterpartName}
        </h1>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
          {b.status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        {b.segments.map((s, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="capitalize">{s.segmentType}</span>
            <span className="text-muted-foreground">{fmt(s.startAt)} – {new Date(s.endAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
        {b.isSharedWalk && <p className="text-xs text-trust-strong">Shared (group) walk</p>}
        {b.dropoffRequired && <p className="text-xs text-muted-foreground">Drop-off at home requested</p>}
      </div>

      {b.status === "expired" && b.role === "customer" && (
        <div className="mt-5 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This walker didn&apos;t respond in time. Find another walker near you.</span>
          </div>
          <Link
            href={routes.walkers}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Find a walker
          </Link>
        </div>
      )}

      {b.status === "in_progress" && (
        <WalkCountdown
          actualStartAt={b.actualStartAt}
          scheduledStartAt={b.startAt}
          scheduledEndAt={b.endAt}
        />
      )}

      {b.status === "completed" && b.actualStartAt && b.actualEndAt && (
        <div className="mt-5 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Actual time</span>
            <span className="font-medium">
              {time(b.actualStartAt)} – {time(b.actualEndAt)} · {durationMins(b.actualStartAt, b.actualEndAt)} min
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Booked time</span>
            <span className="text-muted-foreground">{durationMins(b.startAt, b.endAt)} min</span>
          </div>
          {b.endedEarly && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-trust-subtle p-3 text-sm text-trust-strong">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Ended early — finished noticeably short of the booked duration. Flagged for review.</span>
            </div>
          )}
          {b.missedMidPhoto && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-trust-subtle p-3 text-sm text-trust-strong">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>No halfway photo — the walker skipped the mid-walk check-in. Flagged for review.</span>
            </div>
          )}
        </div>
      )}

      {(b.status === "in_progress" || b.status === "completed") && (
        <WalkPhotos bookingId={id} live={b.status === "in_progress"} />
      )}

      {b.priceBreakdown && (
        <div className="mt-4 space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          {b.priceBreakdown.lines.map((l, i) => (
            <div key={i} className={cn("flex justify-between text-sm", l.amount < 0 ? "text-trust-strong" : "text-foreground")}>
              <span>{l.label}</span>
              <span>{l.amount < 0 ? `−${money(b.priceBreakdown!.currency, Math.abs(l.amount))}` : money(b.priceBreakdown!.currency, l.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 text-base font-medium">
            <span>Total</span>
            <span>{money(b.priceBreakdown.currency, b.priceBreakdown.total)}</span>
          </div>
        </div>
      )}

      {b.specialInstructions && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Notes</p>
          <p className="mt-1 text-sm">{b.specialInstructions}</p>
        </div>
      )}

      {b.role === "customer" && <PaymentSection bookingId={id} bookingStatus={b.status} />}

      <div className="mt-6 flex flex-wrap gap-2">
        {isWalker && b.status === "requested" && (
          <>
            <Button onClick={() => run("accept", "Booking accepted")} loading={pending}>Accept</Button>
            <Button variant="outline" onClick={() => setDeclining(true)} disabled={pending}>Decline</Button>
          </>
        )}
        {isWalker && b.status === "accepted" && (() => {
          const win = startWindow(b.startAt);
          return (
            <div className="flex flex-col gap-1">
              <Button onClick={() => setCapture("start")} disabled={pending || !win.canStart}>Start walk</Button>
              {win.hint && <span className="text-xs text-muted-foreground">{win.hint}</span>}
            </div>
          );
        })()}
        {isWalker && b.status === "in_progress" && (
          <>
            <Button onClick={() => setCapture("complete")} disabled={pending}>Mark complete</Button>
            <Button variant="outline" onClick={() => setCapture("mid")} disabled={pending}>Add halfway photo</Button>
          </>
        )}
        {(b.status === "requested" || b.status === "accepted") && (
          <Button variant="ghost" onClick={() => run("cancel", "Booking cancelled")} disabled={pending}>Cancel</Button>
        )}
      </div>

      {capture === "start" && (
        <WalkPhotoCapture
          title="Photo to start the walk"
          hint="Take a clear photo of the pet — the owner sees this the moment you begin."
          submitLabel="Start walk"
          pending={startWalk.isPending}
          onSubmit={(file) => submitPhoto(startWalk, file, "Walk started")}
          onCancel={() => setCapture(null)}
        />
      )}
      {capture === "mid" && (
        <WalkPhotoCapture
          title="Halfway photo"
          hint="A quick mid-walk photo reassures the owner their pet is doing well."
          submitLabel="Send photo"
          pending={midPhoto.isPending}
          onSubmit={(file) => submitPhoto(midPhoto, file, "Halfway photo sent")}
          onCancel={() => setCapture(null)}
        />
      )}
      {capture === "complete" && (
        <WalkPhotoCapture
          title="Photo to finish the walk"
          hint="Take a final photo of the pet to wrap up and mark the walk complete."
          submitLabel="Mark complete"
          pending={completeWalk.isPending}
          onSubmit={(file) => submitPhoto(completeWalk, file, "Walk completed")}
          onCancel={() => setCapture(null)}
        />
      )}

      {b.status === "completed" && b.role === "customer" && (
        <BookingReviewSection bookingId={id} walkerName={b.counterpartName} />
      )}

      {b.role === "customer" && (b.status === "in_progress" || b.status === "completed") && (
        <DisputeSection bookingId={id} />
      )}

      <DeclineDialog bookingId={id} open={declining} onClose={() => setDeclining(false)} />
    </main>
  );
}

export default function BookingDetailPage() {
  return (
    <Protected>
      <BookingInner />
    </Protected>
  );
}
