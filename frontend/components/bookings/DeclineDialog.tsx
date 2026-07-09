"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/SelectField";
import { TextareaField } from "../ui/Textarea";
import { useDeclineBooking } from "../../hooks/useBookings";
import { getApiErrorMessage } from "../../lib/forms";
import type { DeclineReason } from "../../lib/types";

const REASON_OPTIONS: { value: DeclineReason; label: string }[] = [
  { value: "unavailable", label: "Not available at that time" },
  { value: "too_far", label: "Outside my area / too far" },
  { value: "dog_fit", label: "Dog isn't a fit (size, breed, temperament)" },
  { value: "too_many_dogs", label: "Too many dogs to handle" },
  { value: "special_needs", label: "Can't accommodate special needs (medical / reactive)" },
  { value: "uncomfortable", label: "Not comfortable with this request" },
  { value: "other", label: "Something else" },
];

interface Props {
  bookingId: string;
  open: boolean;
  onClose: () => void;
  onDeclined?: () => void;
}

/**
 * Walker's "why are you declining?" step. A reason is required (one tap); the
 * note is optional. The owner never sees this — it feeds our analytics/triage
 * and admin. Mirrors DisputeSection's field pattern.
 */
export function DeclineDialog({ bookingId, open, onClose, onDeclined }: Props) {
  const decline = useDeclineBooking(bookingId);
  const [reason, setReason] = useState<DeclineReason | "">("");
  const [note, setNote] = useState("");

  if (!open) return null;

  function submit() {
    if (!reason) return toast.error("Please choose a reason for declining.");
    decline.mutate(
      { reasonCode: reason, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Booking declined");
          onClose();
          onDeclined?.();
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      }
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => !decline.isPending && onClose()}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Decline this booking"
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-xl"
      >
        <p className="text-sm font-medium">Decline this request</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Let us know why so we can send you better-matched requests. The owner won&apos;t see your
          reason — just that you&apos;re not available.
        </p>
        <div className="space-y-3">
          <SelectField
            label="Reason for declining"
            placeholder="Choose a reason…"
            options={REASON_OPTIONS}
            value={reason}
            onChange={(e) => setReason(e.target.value as DeclineReason)}
          />
          <TextareaField
            label="Add a note (optional)"
            placeholder="e.g. I'm already booked with another dog at that time."
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={submit} loading={decline.isPending}>
            Decline booking
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={decline.isPending}>
            Keep it
          </Button>
        </div>
      </div>
    </>
  );
}
