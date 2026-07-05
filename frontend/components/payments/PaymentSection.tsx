"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { ShieldCheck, Lock, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";
import { useCreateIntent, usePaymentConfig, usePaymentView } from "../../hooks/usePayments";
import { getApiErrorMessage } from "../../lib/forms";
import type { PaymentIntentResult } from "../../lib/types";

const money = (cur: string, n: number) =>
  cur === "USD" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${cur}`;

interface Props {
  bookingId: string;
  /** Booking status — the pay CTA only opens once the walker has accepted. */
  bookingStatus: string;
}

/** loadStripe returns a promise; cache it per publishable key so it's created once. */
const stripeCache = new Map<string, Promise<Stripe | null>>();
function stripeFor(key: string): Promise<Stripe | null> {
  let p = stripeCache.get(key);
  if (!p) {
    p = loadStripe(key);
    stripeCache.set(key, p);
  }
  return p;
}

/**
 * Customer-facing escrow payment. The customer "pays" by authorizing a HOLD on
 * their card once the walker accepts — the money isn't captured until the walk
 * is completed. We show the current escrow state (held / captured / refunded)
 * and, when nothing is held yet, a button to place the hold.
 */
export function PaymentSection({ bookingId, bookingStatus }: Props) {
  const config = usePaymentConfig();
  const { data: view, isLoading } = usePaymentView(bookingId);
  const createIntent = useCreateIntent(bookingId);
  const [intent, setIntent] = useState<PaymentIntentResult | null>(null);

  // Payments not configured on this deployment — hide the section entirely.
  if (config.data && !config.data.configured) return null;
  if (isLoading || !view) {
    return <div className="mt-4 h-20 w-full animate-pulse rounded-2xl bg-muted" aria-hidden="true" />;
  }

  // Held / captured / refunded — show the escrow status instead of a pay CTA.
  if (view.status === "held") {
    return (
      <StatusCard
        icon={<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />}
        title="Payment held in escrow"
        body={`${money(view.currency, view.amount)} is on hold. We charge it once the walk is completed — and release it back if it doesn't happen.`}
      />
    );
  }
  if (view.status === "captured") {
    return (
      <StatusCard
        icon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />}
        title="Payment complete"
        body={`${money(view.currency, view.amount)} was charged after the walk was completed.`}
      />
    );
  }
  if (view.status === "refunded") {
    const refunded = view.refundedAmount > 0;
    return (
      <StatusCard
        icon={<RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />}
        title={refunded ? "Refunded" : "Hold released"}
        body={
          refunded
            ? `${money(view.currency, view.refundedAmount)} was refunded to your card.`
            : "The hold on your card was released — you weren't charged."
        }
      />
    );
  }

  // status is "none", "pending", or "failed" — offer to place / retry the hold,
  // but only once the walker has accepted the booking.
  if (bookingStatus !== "accepted") return null;

  // Elements mounted — the customer is confirming the hold.
  if (intent) {
    const key = intent.publishableKey;
    if (!key) {
      return (
        <StatusCard
          icon={<Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
          title="Payment unavailable"
          body="Card payments aren't available right now. Please try again later."
        />
      );
    }
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Authorize {money(intent.currency, intent.amount)}</p>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          We place a hold on your card now and only charge it once the walk is completed.
        </p>
        <Elements
          stripe={stripeFor(key)}
          options={{ clientSecret: intent.clientSecret, appearance: { theme: "stripe" } }}
        >
          <HoldForm
            amountLabel={money(intent.currency, intent.amount)}
            onDone={() => setIntent(null)}
            onCancel={() => setIntent(null)}
          />
        </Elements>
      </div>
    );
  }

  const placeHold = () =>
    createIntent.mutate(undefined, {
      onSuccess: (res) => setIntent(res),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });

  const failed = view.status === "failed";
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />
        <div>
          <p className="text-sm font-medium">
            {failed ? "Payment didn't go through" : "Secure the booking"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {failed
              ? "Your last attempt failed. Try placing the hold again."
              : `We hold ${money(view.currency, view.amount)} on your card and only charge it once the walk is completed.`}
          </p>
        </div>
      </div>
      <Button className="mt-4 w-full" onClick={placeHold} loading={createIntent.isPending}>
        {failed ? "Try again" : `Pay ${money(view.currency, view.amount)} — held until done`}
      </Button>
    </div>
  );
}

/** The confirm step, rendered inside <Elements> so it can access Stripe.js. */
function HoldForm({
  amountLabel,
  onDone,
  onCancel,
}: {
  amountLabel: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Payment couldn't be authorized.");
      return;
    }
    // Success: the hold is placed. The webhook flips the payment row to "held";
    // closing the form lets usePaymentView refetch and show the held card.
    toast.success("Payment held — you're all set until the walk is done.");
    onDone();
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2">
        <Button className="flex-1" onClick={confirm} loading={submitting} disabled={!stripe}>
          Hold {amountLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}
