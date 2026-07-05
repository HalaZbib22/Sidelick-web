"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/SelectField";
import { TextareaField } from "../ui/Textarea";
import { useDispute, useOpenDispute } from "../../hooks/useBookings";
import { getApiErrorMessage } from "../../lib/forms";
import type { DisputeReason } from "../../lib/types";

const REASON_OPTIONS: { value: DisputeReason; label: string }[] = [
  { value: "no_show", label: "Walker never showed up" },
  { value: "ended_early", label: "Walk ended too early" },
  { value: "missing_photos", label: "Didn't send the photos" },
  { value: "pet_welfare", label: "Concern about my pet's wellbeing" },
  { value: "other", label: "Something else" },
];

const REASON_LABEL: Record<DisputeReason, string> = Object.fromEntries(
  REASON_OPTIONS.map((o) => [o.value, o.label])
) as Record<DisputeReason, string>;

interface Props {
  bookingId: string;
}

/**
 * Customer-facing "Report an issue" for a walk that's underway or finished.
 * Opening a report pauses the walker's payout and routes to our team — it does
 * NOT auto-refund. If a report already exists, we show its status instead.
 */
export function DisputeSection({ bookingId }: Props) {
  const { data: dispute, isLoading } = useDispute(bookingId);
  const open = useOpenDispute(bookingId);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [note, setNote] = useState("");

  if (isLoading) {
    return <div className="mt-4 h-16 w-full animate-pulse rounded-2xl bg-muted" aria-hidden="true" />;
  }

  // Already reported — show status rather than the form.
  if (dispute) {
    const resolved = dispute.status !== "open";
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />
          <div>
            <p className="text-sm font-medium">
              {resolved ? "Issue reviewed" : "Issue under review"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              You reported: {REASON_LABEL[dispute.reason]}.
              {dispute.status === "open" &&
                " Our team is looking into it and the walker's payout is paused."}
              {dispute.resolution === "refund_full" &&
                ` We refunded you in full (${dispute.refundAmount.toFixed(2)}).`}
              {dispute.resolution === "refund_partial" &&
                ` We refunded you ${dispute.refundAmount.toFixed(2)}.`}
              {dispute.resolution === "denied" &&
                " After review, the booking was found to be completed as agreed."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function submit() {
    if (!reason) return toast.error("Please choose what went wrong.");
    open.mutate(
      { reason, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Thanks — our team will review this.");
          setShowForm(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      }
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="mt-6 flex w-full items-center gap-2 rounded-2xl border border-border bg-surface p-4 text-left text-sm text-muted-foreground transition hover:border-amber-300 hover:text-foreground"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        Something go wrong with this walk? Report an issue.
      </button>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">Report an issue</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Tell us what happened. This pauses the walker&apos;s payout while our team reviews it — it
        won&apos;t charge or refund automatically.
      </p>
      <div className="space-y-3">
        <SelectField
          label="What went wrong?"
          placeholder="Choose a reason…"
          options={REASON_OPTIONS}
          value={reason}
          onChange={(e) => setReason(e.target.value as DisputeReason)}
        />
        <TextareaField
          label="Add details (optional)"
          placeholder="e.g. The walk was booked for 60 min but ended after 15."
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} loading={open.isPending}>Submit report</Button>
        <Button variant="ghost" onClick={() => setShowForm(false)} disabled={open.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
