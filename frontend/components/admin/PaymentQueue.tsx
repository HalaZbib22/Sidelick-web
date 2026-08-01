"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";
import { Button } from "../ui/Button";
import { Skeleton, ListSkeleton } from "../ui/Skeleton";
import { apiFetch } from "../../lib/api";
import { api } from "../../lib/paths";
import { getApiErrorMessage } from "../../lib/forms";
import { useAdminSettlements, useReviewSettlement } from "../../hooks/useSettlements";

interface PendingPayment {
  bookingId: string;
  provider: "whish" | "omt" | "bob";
  amount: string;
  currency: string;
  reference: string | null;
  markedPaidAt: string;
  customerName: string;
  walkerName: string;
}

const PROVIDER_LABEL: Record<PendingPayment["provider"], string> = {
  whish: "Whish",
  omt: "OMT",
  bob: "BOB Finance",
};

const money = (cur: string, n: string) =>
  cur === "USD" ? `$${Number(n).toFixed(2)}` : `${Number(n).toFixed(2)} ${cur}`;

/**
 * Manual-rail payments the customer says they've sent (Whish / OMT / BOB) but
 * that no admin has confirmed yet. Confirming flips the payment to held so the
 * walk can start.
 */
export function PaymentQueue() {
  const qc = useQueryClient();
  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin", "payments-pending"],
    queryFn: async () => {
      const d = await apiFetch<{ payments: PendingPayment[] }>(api.adminPendingPayments);
      return d.payments;
    },
  });

  const confirm = useMutation({
    mutationFn: (bookingId: string) =>
      apiFetch(api.adminConfirmPayment(bookingId), { method: "POST" }),
    onSuccess: () => {
      toast.success("Payment confirmed");
      qc.invalidateQueries({ queryKey: ["admin", "payments-pending"] });
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Whish / OMT / BOB payments customers report having sent. Confirm once the money lands to
        secure the booking.
      </p>

      {isLoading ? (
        <ListSkeleton count={3}>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </ListSkeleton>
      ) : !payments || payments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No payments awaiting confirmation.
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div key={p.bookingId} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {money(p.currency, p.amount)} · {PROVIDER_LABEL[p.provider]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {p.customerName} → {p.walkerName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ref <span className="font-mono">{p.reference}</span> · reported{" "}
                    {new Date(p.markedPaidAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  onClick={() => confirm.mutate(p.bookingId)}
                  disabled={confirm.isPending}
                >
                  Confirm
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SettlementQueue />
    </>
  );
}

/** Walker cash-commission settlements awaiting confirmation. */
function SettlementQueue() {
  const { data: settlements, isLoading } = useAdminSettlements("pending");
  const review = useReviewSettlement();

  function act(id: string, action: "confirm" | "reject") {
    review.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast.success(action === "confirm" ? "Settlement confirmed — balance cleared" : "Settlement rejected"),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      }
    );
  }

  return (
    <div className="mt-8">
      <h3 className="font-display mb-1 flex items-center gap-2 text-lg font-medium">
        <HandCoins className="h-4 w-4 text-warning" /> Commission settlements
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Walkers paying off their cash-commission balance. Confirm once the money lands —
        that clears their ledger and unblocks bookings.
      </p>

      {isLoading ? (
        <ListSkeleton count={2}>
          <div className="h-20 rounded-xl border border-border bg-surface" />
        </ListSkeleton>
      ) : !settlements || settlements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No settlements awaiting confirmation.
        </div>
      ) : (
        <div className="space-y-3">
          {settlements.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {money(s.currency, String(s.amount))} · {PROVIDER_LABEL[s.method]}
                  </p>
                  <p className="text-sm text-muted-foreground">from {s.walkerName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ref <span className="font-mono">{s.reference}</span> · opened{" "}
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={() => act(s.id, "confirm")} disabled={review.isPending}>
                    Confirm
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => act(s.id, "reject")}
                    disabled={review.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
