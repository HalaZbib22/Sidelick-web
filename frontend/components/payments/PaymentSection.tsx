"use client";

import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  RotateCcw,
  CreditCard,
  Smartphone,
  Banknote,
  Building2,
  Wallet,
  Clock,
} from "lucide-react";
import { Button } from "../ui/Button";
import {
  useCreateIntent,
  usePaymentConfig,
  usePaymentView,
  useSelectMethod,
  useMarkPaid,
} from "../../hooks/usePayments";
import { getApiErrorMessage } from "../../lib/forms";
import type { PaymentIntentResult, PaymentMethod, PaymentView } from "../../lib/types";

const money = (cur: string, n: number) =>
  cur === "USD" ? `$${n.toFixed(2)}` : `${n.toFixed(2)} ${cur}`;

type ManualMethod = Exclude<PaymentMethod, "card">;

const METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: typeof CreditCard; blurb: string }
> = {
  card: { label: "Card", icon: CreditCard, blurb: "Held now, charged when the walk is done" },
  whish: { label: "Whish", icon: Smartphone, blurb: "Pay from the Whish app" },
  omt: { label: "OMT", icon: Building2, blurb: "Pay at any OMT branch" },
  bob: { label: "BOB Finance", icon: Building2, blurb: "Pay at any BOB Finance branch" },
  cash: { label: "Cash", icon: Banknote, blurb: "Pay your walker in person at the walk" },
};

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
 * Customer-facing payment. The customer picks a rail once the walker accepts:
 *   • Card — authorize a HOLD (Stripe Elements); captured when the walk is done.
 *   • Whish / OMT / BOB — pay the platform out-of-band against a reference; an
 *     admin confirms receipt, which secures the booking.
 *   • Cash — settle with the walker in person at the walk.
 * We show the current state and, while nothing is committed, the method picker.
 */
export function PaymentSection({ bookingId, bookingStatus }: Props) {
  const config = usePaymentConfig();
  const { data: view, isLoading } = usePaymentView(bookingId);
  const createIntent = useCreateIntent(bookingId);
  const selectMethod = useSelectMethod(bookingId);
  const [intent, setIntent] = useState<PaymentIntentResult | null>(null);
  // Lets the customer re-open the picker after a manual rail is committed.
  const [choosing, setChoosing] = useState(false);

  // No payment methods available at all — hide the section entirely.
  if (config.data && !config.data.configured) return null;
  if (isLoading || !view) {
    return <div className="mt-4 h-20 w-full animate-pulse rounded-2xl bg-muted" aria-hidden="true" />;
  }

  const isCash = view.method === "cash";

  // Secured / done / refunded — show status instead of a pay CTA.
  if (view.status === "held") {
    return (
      <StatusCard
        icon={<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />}
        title={view.method === "card" ? "Payment held in escrow" : "Payment confirmed"}
        body={
          view.method === "card"
            ? `${money(view.currency, view.amount)} is on hold. We charge it once the walk is completed — and release it back if it doesn't happen.`
            : `We've confirmed your ${methodLabel(view.method)} payment of ${money(view.currency, view.amount)}. Your booking is secured.`
        }
      />
    );
  }
  if (view.status === "captured") {
    return (
      <StatusCard
        icon={<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />}
        title={isCash ? "Paid in cash" : "Payment complete"}
        body={
          isCash
            ? `You paid ${money(view.currency, view.amount)} in cash to your walker.`
            : `${money(view.currency, view.amount)} was charged after the walk was completed.`
        }
      />
    );
  }
  if (view.status === "refunded") {
    const refunded = view.refundedAmount > 0;
    return (
      <StatusCard
        icon={<RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />}
        title={refunded ? "Refunded" : "Payment released"}
        body={
          refunded
            ? `${money(view.currency, view.refundedAmount)} was refunded to you.`
            : "This booking was cancelled — you weren't charged."
        }
      />
    );
  }

  // status is "none", "pending", or "failed" — the customer needs to act, but
  // only once the walker has accepted the booking.
  if (bookingStatus !== "accepted") return null;

  // Card Elements mounted — the customer is confirming the hold.
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

  // A manual rail or cash is committed (pending) and the customer isn't switching
  // — show the pay-out-of-band instructions / cash note.
  const committedManual = view.status === "pending" && view.method && view.method !== "card";
  if (committedManual && !choosing) {
    if (isCash) {
      return <CashPending view={view} onChange={() => setChoosing(true)} />;
    }
    return (
      <ManualPending
        bookingId={bookingId}
        view={view}
        onChange={() => setChoosing(true)}
      />
    );
  }

  // Otherwise show the method picker (nothing committed yet, a failed attempt, or
  // the customer chose to switch methods).
  const placeCardHold = () =>
    createIntent.mutate(undefined, {
      onSuccess: (res) => {
        setChoosing(false);
        setIntent(res);
      },
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });

  const pickManual = (method: ManualMethod) =>
    selectMethod.mutate(method, {
      onSuccess: () => setChoosing(false),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });

  const methods = (config.data?.methods ?? view.methods) as PaymentMethod[];
  const busy = createIntent.isPending || selectMethod.isPending;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-2">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />
        <div>
          <p className="text-sm font-medium">
            {view.status === "failed" ? "Payment didn't go through" : "Choose how to pay"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {money(view.currency, view.amount)} for this booking. Pick a method to secure it.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {methods.map((m) => {
          const meta = METHOD_META[m];
          const Icon = meta.icon;
          return (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => (m === "card" ? placeCardHold() : pickManual(m as ManualMethod))}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block text-xs text-muted-foreground">{meta.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      {choosing && committedManual && (
        <button
          type="button"
          onClick={() => setChoosing(false)}
          className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          Keep my current method
        </button>
      )}
    </div>
  );
}

function methodLabel(m: PaymentMethod | null): string {
  return m ? METHOD_META[m].label : "";
}

/** Out-of-band instructions for Whish / OMT / BOB, plus the "I've sent it" action. */
function ManualPending({
  bookingId,
  view,
  onChange,
}: {
  bookingId: string;
  view: PaymentView;
  onChange: () => void;
}) {
  const markPaid = useMarkPaid(bookingId);
  const label = methodLabel(view.method);

  const send = () =>
    markPaid.mutate(undefined, {
      onSuccess: () => toast.success("Thanks — we'll confirm your payment shortly."),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />
        <div>
          <p className="text-sm font-medium">Send {money(view.currency, view.amount)} via {label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pay the amount using {label}, quoting the reference below. We'll confirm receipt and
            secure your booking.
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 rounded-xl bg-muted/60 p-3 text-sm">
        {view.destination && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Pay to</dt>
            <dd className="font-medium">{view.destination}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="font-mono font-medium tracking-tight">{view.reference}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="font-medium">{money(view.currency, view.amount)}</dd>
        </div>
      </dl>

      {view.payerMarkedPaid ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-trust-subtle px-3 py-2.5 text-sm text-trust-strong">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Waiting for us to confirm your payment.</span>
        </div>
      ) : (
        <Button className="mt-4 w-full" onClick={send} loading={markPaid.isPending}>
          I've sent it
        </Button>
      )}

      <button
        type="button"
        onClick={onChange}
        className="mt-3 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
      >
        Use a different method
      </button>
    </div>
  );
}

/** Cash is settled in person — just remind the customer to pay the walker. */
function CashPending({ view, onChange }: { view: PaymentView; onChange: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-2">
        <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-trust-strong" />
        <div>
          <p className="text-sm font-medium">Pay {money(view.currency, view.amount)} in cash</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hand the cash to your walker at the walk. Your booking is set — no card needed.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="mt-4 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
      >
        Use a different method
      </button>
    </div>
  );
}

/** The card confirm step, rendered inside <Elements> so it can access Stripe.js. */
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
