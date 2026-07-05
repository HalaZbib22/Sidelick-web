"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Camera, Clock, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";
import { Skeleton, ListSkeleton } from "../ui/Skeleton";
import { useAdminDisputes, useResolveDispute } from "../../hooks/useAdminDisputes";
import { getApiErrorMessage } from "../../lib/forms";
import type { AdminDispute, DisputeReason, DisputeResolution } from "../../lib/types";

const REASON_LABEL: Record<DisputeReason, string> = {
  no_show: "Walker never showed up",
  ended_early: "Walk ended too early",
  missing_photos: "Didn't send the photos",
  pet_welfare: "Concern about pet's wellbeing",
  other: "Something else",
};

const money = (cur: string, n: number) =>
  cur === "USD" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${cur}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** One open dispute with the controls to resolve it. */
function OpenDisputeCard({
  d,
  onResolve,
  pending,
}: {
  d: AdminDispute;
  onResolve: (input: {
    id: string;
    resolution: DisputeResolution;
    refundAmount?: number;
    walkerLiable?: boolean;
  }) => void;
  pending: boolean;
}) {
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState("");
  // Default: walker at fault → refund docked from their payout. Admin can flip this
  // to platform goodwill (walker keeps full earnings) for either refund path.
  const [platformCovers, setPlatformCovers] = useState(false);
  const walkerLiable = !platformCovers;

  const submitPartial = () => {
    const n = Number(amount);
    if (!(n > 0 && n < d.amount)) {
      toast.error(`Enter an amount between 0 and ${d.amount.toFixed(2)}.`);
      return;
    }
    onResolve({ id: d.id, resolution: "refund_partial", refundAmount: n, walkerLiable });
  };

  const captured = d.paymentStatus === "captured";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            {REASON_LABEL[d.reason]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {d.customerName} → {d.walkerName} · {d.serviceType.replace("_", " + ")} ·{" "}
            {fmtDate(d.startAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Booking {money(d.currency, d.amount)} · payment: {d.paymentStatus}
            {d.refundedAmount > 0 && ` · refunded ${money(d.currency, d.refundedAmount)}`}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(d.createdAt)}</span>
      </div>

      {d.note && (
        <p className="mt-2 rounded-lg bg-surface p-2 text-xs text-foreground">“{d.note}”</p>
      )}

      {(d.endedEarly || d.missedMidPhoto) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {d.endedEarly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-trust-subtle px-2 py-0.5 text-[11px] text-trust-strong">
              <Clock className="h-3 w-3" /> Ended early
            </span>
          )}
          {d.missedMidPhoto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-trust-subtle px-2 py-0.5 text-[11px] text-trust-strong">
              <Camera className="h-3 w-3" /> No halfway photo
            </span>
          )}
        </div>
      )}

      {!captured && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          No captured charge on this booking — resolving records the verdict without moving money.
        </p>
      )}

      <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={platformCovers}
          onChange={(e) => setPlatformCovers(e.target.checked)}
          disabled={pending}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        />
        <span>
          Platform covers this refund — don&apos;t dock {d.walkerName.split(" ")[0]}&apos;s earnings.
          <span className="block text-[11px] text-muted-foreground/80">
            By default a refund is taken from the walker&apos;s held payout (they were at fault).
            Check this for goodwill refunds the platform absorbs.
          </span>
        </span>
      </label>

      {partial ? (
        <div className="mt-3 flex items-end gap-2">
          <label className="flex-1 text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">
              Refund amount ({d.currency})
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={d.amount}
              step="0.01"
              placeholder={`e.g. ${(d.amount / 2).toFixed(2)}`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <Button onClick={submitPartial} loading={pending}>
            Refund
          </Button>
          <Button variant="ghost" onClick={() => setPartial(false)} disabled={pending}>
            Back
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => onResolve({ id: d.id, resolution: "refund_full", walkerLiable })}
            disabled={pending}
          >
            Refund full ({money(d.currency, d.amount)})
          </Button>
          <Button variant="outline" onClick={() => setPartial(true)} disabled={pending}>
            Partial refund
          </Button>
          <Button
            variant="ghost"
            onClick={() => onResolve({ id: d.id, resolution: "denied" })}
            disabled={pending}
          >
            Deny
          </Button>
        </div>
      )}
    </div>
  );
}

/** Read-only card for an already-resolved dispute. */
function ResolvedDisputeCard({ d }: { d: AdminDispute }) {
  const refunded = d.refundAmount > 0;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 shrink-0 text-trust-strong" />
            {REASON_LABEL[d.reason]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {d.customerName} → {d.walkerName} · {fmtDate(d.startAt)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {refunded
              ? `Refunded ${money(d.currency, d.refundAmount)}`
              : "Denied — completed as agreed"}
          </p>
          {refunded && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {d.walkerLiable
                ? d.walkerDeduction > 0
                  ? `${money(d.currency, d.walkerDeduction)} docked from ${d.walkerName.split(" ")[0]}'s payout`
                  : `Charged to ${d.walkerName.split(" ")[0]}'s payout`
                : "Platform covered — walker paid in full"}
            </p>
          )}
        </div>
        <span className="shrink-0 text-[11px] capitalize text-muted-foreground">{d.status}</span>
      </div>
    </div>
  );
}

export function DisputeQueue() {
  const [tab, setTab] = useState<"open" | "history">("open");
  const { data: raw, isLoading } = useAdminDisputes(tab === "open" ? "open" : "all");
  const resolve = useResolveDispute();

  // History = every closed dispute (resolved OR denied/rejected).
  const disputes = tab === "history" ? raw?.filter((d) => d.status !== "open") : raw;

  const onResolve = (input: {
    id: string;
    resolution: DisputeResolution;
    refundAmount?: number;
    walkerLiable?: boolean;
  }) =>
    resolve.mutate(input, {
      onSuccess: () => toast.success("Dispute resolved"),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["open", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition " +
              (tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton count={2}>
          <div className="rounded-xl border border-border bg-surface p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
            <Skeleton className="mt-3 h-9 w-full rounded-lg" />
          </div>
        </ListSkeleton>
      ) : !disputes || disputes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {tab === "open" ? "No open disputes. All clear." : "No resolved disputes yet."}

        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) =>
            d.status === "open" ? (
              <OpenDisputeCard key={d.id} d={d} onResolve={onResolve} pending={resolve.isPending} />
            ) : (
              <ResolvedDisputeCard key={d.id} d={d} />
            )
          )}
        </div>
      )}
    </div>
  );
}
