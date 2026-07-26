"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Cat, Dog, Flag } from "lucide-react";
import { Button } from "../ui/Button";
import { TextareaField } from "../ui/Textarea";
import { ListSkeleton, BookingCardSkeleton } from "../ui/Skeleton";
import { useAdminPetReports, useReviewPetReport } from "../../hooks/useAdminPetReports";
import { getApiErrorMessage } from "../../lib/forms";
import { PET_REPORT_CATEGORY_LABELS, type AdminPetReport } from "../../lib/types";

/** Admin queue for walker-filed pet-profile reports — mirrors DisputeQueue. */
export function PetReportQueue() {
  const [sub, setSub] = useState<"open" | "history">("open");
  const { data: reports, isLoading } = useAdminPetReports(
    sub === "open" ? "open" : undefined
  );

  const shown =
    sub === "open" ? reports : reports?.filter((r) => r.status !== "open");

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["open", "history"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSub(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              sub === k
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton count={3}>
          <BookingCardSkeleton />
        </ListSkeleton>
      ) : !shown || shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {sub === "open" ? "No open pet reports. All clear!" : "No reviewed reports yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report: r }: { report: AdminPetReport }) {
  const review = useReviewPetReport();
  const [note, setNote] = useState("");
  const open = r.status === "open";

  function act(action: "reviewed" | "dismissed") {
    review.mutate(
      { id: r.id, action, note: note.trim() || undefined },
      {
        onSuccess: () => toast.success(action === "reviewed" ? "Marked reviewed" : "Dismissed"),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      }
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {r.petPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.petPhotoUrl}
            alt={r.petName}
            className="h-11 w-11 shrink-0 rounded-full object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-subtle to-trust-subtle text-primary">
            {r.petSpecies === "cat" ? <Cat className="h-5 w-5" /> : <Dog className="h-5 w-5" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-medium">
            {r.petName}
            {r.petBreed && (
              <span className="text-xs font-normal text-muted-foreground">· {r.petBreed}</span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                open
                  ? "bg-warning/10 text-warning"
                  : r.status === "reviewed"
                    ? "bg-trust-subtle text-trust-strong"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {r.status}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reported by {r.walkerName} · owner {r.ownerName} ·{" "}
            {new Date(r.createdAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Flag className="h-3 w-3" />
            {PET_REPORT_CATEGORY_LABELS[r.category]}
          </p>
          {r.note && <p className="mt-2 text-sm leading-relaxed">{r.note}</p>}
          {r.adminNote && (
            <p className="mt-2 text-xs text-muted-foreground">Admin note: {r.adminNote}</p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <TextareaField
            label="Internal note (optional)"
            placeholder="e.g. Called the owner — profile updated to reflect reactivity."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
          />
          <div className="flex gap-2">
            <Button onClick={() => act("reviewed")} loading={review.isPending} className="flex-1">
              Mark reviewed
            </Button>
            <Button
              variant="outline"
              onClick={() => act("dismissed")}
              disabled={review.isPending}
              className="flex-1"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
