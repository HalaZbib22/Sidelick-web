"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Cat, Dog, Flag, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/SelectField";
import { TextareaField } from "../ui/Textarea";
import { useConfirmPets, useFilePetReport, usePetReports } from "../../hooks/useBookings";
import { getApiErrorMessage } from "../../lib/forms";
import {
  friendlyLabel,
  PET_REPORT_CATEGORY_LABELS,
  SIZE_LABELS,
  type BookingDetail,
  type BookingPet,
  type PetReportCategory,
  type PetReportStatus,
} from "../../lib/types";

const REPORT_STATUS_LABEL: Record<PetReportStatus, string> = {
  open: "Report under review",
  reviewed: "Report reviewed ✔",
  dismissed: "Report closed",
};

/**
 * Walker-side handoff card: the pets on this booking, exactly as their owner
 * described them. The walker confirms the profiles match reality — and can
 * flag inaccuracies (the walker-side mirror of customer disputes).
 */
export function PetConfirmCard({ booking }: { booking: BookingDetail }) {
  const confirm = useConfirmPets(booking.id);
  const canReport = booking.status === "in_progress" || booking.status === "completed";
  const { data: reports } = usePetReports(booking.id, canReport);
  const [reporting, setReporting] = useState<BookingPet | null>(null);

  const canConfirm =
    !booking.petsConfirmedAt &&
    (booking.status === "accepted" || booking.status === "in_progress");

  if (booking.pets.length === 0) return null;

  const reportFor = (petId: string) => reports?.find((r) => r.petId === petId);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-medium">
          {booking.pets.length === 1 ? "Your client" : "Your clients"}
        </h2>
        {booking.petsConfirmedAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-trust-subtle px-3 py-1 text-xs font-medium text-trust-strong">
            <ShieldCheck className="h-3.5 w-3.5" />
            Confirmed{" "}
            {new Date(booking.petsConfirmedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {booking.pets.map((p) => {
          const report = reportFor(p.id);
          const meta = [
            p.breed,
            p.size ? SIZE_LABELS[p.size] : null,
            friendlyLabel(p.species, p.friendlyWithPets),
          ].filter(Boolean) as string[];
          return (
            <div key={p.id} className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-3">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photoUrl}
                  alt={p.name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-subtle to-trust-subtle text-primary">
                  {p.species === "cat" ? <Cat className="h-5 w-5" /> : <Dog className="h-5 w-5" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {p.name}
                  <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[10px] font-medium capitalize text-link">
                    {p.species}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{meta.join(" · ")}</p>
                {p.notes && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {p.notes}
                  </p>
                )}
                {report && (
                  <p
                    className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      report.status === "open"
                        ? "bg-warning/10 text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {REPORT_STATUS_LABEL[report.status]}
                  </p>
                )}
              </div>
              {canReport && !report && (
                <button
                  type="button"
                  onClick={() => setReporting(p)}
                  aria-label={`Report an issue with ${p.name}'s profile`}
                  title="Report a profile issue"
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                >
                  <Flag className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canConfirm && (
        <Button
          onClick={() =>
            confirm.mutate(undefined, {
              onSuccess: () => toast.success("Thanks — pets confirmed!"),
              onError: (e) => toast.error(getApiErrorMessage(e)),
            })
          }
          loading={confirm.isPending}
          className="mt-4 w-full"
        >
          <ShieldCheck className="h-4 w-4" />
          {booking.pets.length === 1
            ? `Confirm this is ${booking.pets[0].name}`
            : "Confirm these are the right pets"}
        </Button>
      )}
      {canConfirm && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Quick check at handoff — does everything match the profile?
        </p>
      )}

      <PetReportDialog
        bookingId={booking.id}
        pet={reporting}
        onClose={() => setReporting(null)}
      />
    </div>
  );
}

const CATEGORY_OPTIONS = (
  Object.keys(PET_REPORT_CATEGORY_LABELS) as PetReportCategory[]
).map((v) => ({ value: v, label: PET_REPORT_CATEGORY_LABELS[v] }));

function PetReportDialog({
  bookingId,
  pet,
  onClose,
}: {
  bookingId: string;
  pet: BookingPet | null;
  onClose: () => void;
}) {
  const file = useFilePetReport(bookingId);
  const [category, setCategory] = useState<PetReportCategory | "">("");
  const [note, setNote] = useState("");

  if (!pet) return null;

  function submit() {
    if (!category) return toast.error("Choose what went wrong.");
    file.mutate(
      { petId: pet!.id, category, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Report filed — our team will review it.");
          setCategory("");
          setNote("");
          onClose();
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      }
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report an issue with ${pet.name}'s profile`}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-xl"
      >
        <h3 className="font-display text-lg font-medium">
          Report an issue with {pet.name}&apos;s profile
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Goes to the Sidelick team, not the owner. Use it when the profile didn&apos;t
          prepare you for the pet you met.
        </p>
        <div className="mt-4 space-y-3">
          <SelectField
            label="What went wrong?"
            placeholder="Choose a reason"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value as PetReportCategory)}
          />
          <TextareaField
            label="Details (optional)"
            placeholder="e.g. Profile says friendly with other dogs, but Luna lunged at every dog we passed…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={submit} loading={file.isPending} className="flex-1">
            File report
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={file.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  );
}
