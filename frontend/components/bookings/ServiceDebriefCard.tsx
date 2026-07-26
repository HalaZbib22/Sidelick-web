"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { Button } from "../ui/Button";
import { StarRating } from "../ui/StarRating";
import { TextareaField } from "../ui/Textarea";
import { useDebrief, useSubmitDebrief } from "../../hooks/useBookings";
import { getApiErrorMessage } from "../../lib/forms";
import type {
  DebriefHandoff,
  DebriefOwnerCommunication,
  DebriefPetAsDescribed,
  DebriefWorkAgain,
} from "../../lib/types";

/** One tap-chip question. */
function ChipQuestion<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              value === o.value
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Walker's internal post-service debrief — quick structured questions that
 * only the Sidelick team sees. Skippable; either way it's recorded once and
 * the card disappears.
 */
export function ServiceDebriefCard({
  bookingId,
  ownerName,
}: {
  bookingId: string;
  ownerName: string;
}) {
  const { data: existing, isLoading } = useDebrief(bookingId);
  const submit = useSubmitDebrief(bookingId);

  const [overall, setOverall] = useState(0);
  const [petAsDescribed, setPetAsDescribed] = useState<DebriefPetAsDescribed | "">("");
  const [ownerCommunication, setOwnerCommunication] =
    useState<DebriefOwnerCommunication | "">("");
  const [handoff, setHandoff] = useState<DebriefHandoff | "">("");
  const [workAgain, setWorkAgain] = useState<DebriefWorkAgain | "">("");
  const [note, setNote] = useState("");

  // Already handled (submitted or skipped) — nothing to show.
  if (isLoading || existing) return null;

  function send() {
    if (!overall || !petAsDescribed || !ownerCommunication || !handoff || !workAgain) {
      return toast.error("A tap on every question helps us improve — or use Skip.");
    }
    submit.mutate(
      {
        overall,
        petAsDescribed,
        ownerCommunication,
        handoff,
        workAgain,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => toast.success("Thanks — this helps us make Sidelick better!"),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      }
    );
  }

  function skip() {
    submit.mutate(
      { skipped: true },
      { onError: (e) => toast.error(getApiErrorMessage(e)) }
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle text-link">
          <ClipboardList className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-medium">How did it go?</h2>
          <p className="text-xs text-muted-foreground">
            30-second debrief · only the Sidelick team sees this
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Overall, how was this booking?</p>
          <StarRating value={overall} onChange={setOverall} ariaLabel="Overall rating" />
        </div>
        <ChipQuestion
          label="Was the pet as described in its profile?"
          options={[
            { value: "yes", label: "Spot on" },
            { value: "mostly", label: "Mostly" },
            { value: "no", label: "Not really" },
          ]}
          value={petAsDescribed}
          onChange={setPetAsDescribed}
        />
        <ChipQuestion
          label={`How was ${ownerName} to work with?`}
          options={[
            { value: "great", label: "Great" },
            { value: "fine", label: "Fine" },
            { value: "difficult", label: "Difficult" },
          ]}
          value={ownerCommunication}
          onChange={setOwnerCommunication}
        />
        <ChipQuestion
          label="Pickup & drop-off?"
          options={[
            { value: "smooth", label: "Smooth" },
            { value: "minor_issues", label: "Minor hiccups" },
            { value: "problematic", label: "Problematic" },
          ]}
          value={handoff}
          onChange={setHandoff}
        />
        <ChipQuestion
          label="Would you take this owner's bookings again?"
          options={[
            { value: "yes", label: "Anytime" },
            { value: "maybe", label: "Maybe" },
            { value: "no", label: "Rather not" },
          ]}
          value={workAgain}
          onChange={setWorkAgain}
        />
        <TextareaField
          label="Anything we should know? (optional)"
          placeholder="e.g. Address was hard to find — building has no number…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={2}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={send} loading={submit.isPending} className="flex-1">
          Send debrief
        </Button>
        <Button variant="ghost" onClick={skip} disabled={submit.isPending}>
          Skip
        </Button>
      </div>
    </div>
  );
}
