import { query } from "../db.js";
import {
  getProvider,
  getProviderByName,
  getPublishableKey,
  availableMethods,
} from "./index.js";

/** Rails collected out-of-band (customer pays the platform) plus cash. */
export type ManualMethod = "whish" | "omt" | "bob" | "cash";
const MANUAL_METHODS: readonly ManualMethod[] = ["whish", "omt", "bob", "cash"];
export function isManualMethod(m: string): m is ManualMethod {
  return (MANUAL_METHODS as readonly string[]).includes(m);
}

/** payments.method value stored for each manual rail (schema CHECK-constrained). */
const METHOD_COLUMN: Record<ManualMethod, string> = {
  whish: "cash_in",
  omt: "transfer",
  bob: "transfer",
  cash: "cash_on_service",
};

/**
 * Payment domain logic: the bridge between the booking lifecycle and whatever
 * provider is active. Routes and booking transitions call these; none of them
 * import a gateway directly.
 *
 * One `payments` row per booking (schema enforces UNIQUE booking_id):
 *   pending  → intent created, awaiting customer confirmation
 *   held     → funds authorized (hold placed)      [webhook: authorized]
 *   captured → charged on completion               [webhook: succeeded / capture()]
 *   refunded → hold voided, or captured then refunded per cancellation tier
 *   failed   → confirmation failed
 */

export interface PaymentView {
  status: "none" | "pending" | "held" | "captured" | "refunded" | "failed";
  amount: number;
  currency: string;
  refundedAmount: number;
  /** Chosen rail once a payment exists: card | whish | omt | bob | cash. */
  method: "card" | ManualMethod | null;
  /** Reconciliation reference shown to the customer on a manual rail (e.g. WHISH-8F3K2Q). */
  reference: string | null;
  /** Where the customer sends the money on a manual rail (Whish number / OMT or BOB beneficiary). */
  destination: string | null;
  /** True once the customer has self-reported paying a manual rail (awaiting admin confirm). */
  payerMarkedPaid: boolean;
  /** Methods offered when no payment is committed yet (card only when Stripe is set). */
  methods: Array<"card" | ManualMethod>;
}

interface BookingPayRow {
  customer_id: string;
  walker_id: string;
  status: string;
  currency: string;
  quoted_total: string;
  price_breakdown: { walkerPayout?: number } | null;
  start_at: string;
}

interface PaymentRow {
  id: string;
  status: string;
  provider: string;
  method: string;
  amount: string;
  currency: string;
  platform_commission: string;
  walker_payout: string;
  refunded_amount: string;
  provider_ref: string | null;
  payer_marked_paid_at: string | null;
}

async function loadBooking(bookingId: string): Promise<BookingPayRow | null> {
  const r = await query<BookingPayRow>(
    `SELECT customer_id, walker_id, status, currency, quoted_total, price_breakdown, start_at
       FROM bookings WHERE id = $1`,
    [bookingId]
  );
  return r.rows[0] ?? null;
}

async function loadPayment(bookingId: string): Promise<PaymentRow | null> {
  const r = await query<PaymentRow>(
    `SELECT id, status, provider, method, amount, currency,
            platform_commission, walker_payout, refunded_amount,
            provider_ref, payer_marked_paid_at
       FROM payments WHERE booking_id = $1`,
    [bookingId]
  );
  return r.rows[0] ?? null;
}

/**
 * A booking is "paid enough" to start once the money is secured. For card and
 * the manual rails that means held or captured. Cash is settled in person at the
 * walk, so a committed cash payment (anything not refunded/failed) clears the
 * start gate — the walker collects the full amount on-site.
 */
export async function isBookingPaid(bookingId: string): Promise<boolean> {
  const p = await loadPayment(bookingId);
  if (!p) return false;
  if (p.status === "held" || p.status === "captured") return true;
  return p.provider === "cash" && p.status !== "refunded" && p.status !== "failed";
}

interface RailDestinations {
  whish_number: string;
  omt_beneficiary: string;
  bob_beneficiary: string;
}

/** Where the customer sends money for a manual rail, from platform_config. */
async function railDestination(provider: string): Promise<string | null> {
  if (provider !== "whish" && provider !== "omt" && provider !== "bob") return null;
  const r = await query<RailDestinations>(
    "SELECT whish_number, omt_beneficiary, bob_beneficiary FROM platform_config WHERE id = 1"
  );
  const c = r.rows[0];
  if (!c) return null;
  if (provider === "whish") return c.whish_number;
  if (provider === "omt") return c.omt_beneficiary;
  return c.bob_beneficiary;
}

/** Public-facing payment state for a booking (both parties may read it). */
export async function getPaymentView(bookingId: string): Promise<PaymentView> {
  const p = await loadPayment(bookingId);
  if (!p) {
    const b = await loadBooking(bookingId);
    return {
      status: "none",
      amount: b ? Number(b.quoted_total) : 0,
      currency: b?.currency ?? "USD",
      refundedAmount: 0,
      method: null,
      reference: null,
      destination: null,
      payerMarkedPaid: false,
      methods: availableMethods(),
    };
  }
  const method = (p.method === "card" ? "card" : p.provider) as PaymentView["method"];
  return {
    status: p.status as PaymentView["status"],
    amount: Number(p.amount),
    currency: p.currency,
    refundedAmount: Number(p.refunded_amount),
    method,
    reference: p.provider_ref,
    destination: await railDestination(p.provider),
    payerMarkedPaid: !!p.payer_marked_paid_at,
    // Still offer alternatives while the payment is only pending/failed.
    methods:
      p.status === "pending" || p.status === "failed" ? availableMethods() : [],
  };
}

export interface IntentResult {
  clientSecret: string;
  publishableKey: string | null;
  providerRef: string;
  amount: number;
  currency: string;
}

/**
 * Create (or idempotently re-create) an authorization hold for a booking the
 * customer owns. Only valid once the walker has accepted and before funds are
 * already held/captured. Returns the client secret the frontend confirms with.
 */
export async function createIntentForBooking(
  bookingId: string,
  customerId: string
): Promise<
  | { ok: true; intent: IntentResult }
  | { ok: false; code: "notfound" | "forbidden" | "conflict" | "alreadypaid"; message: string }
> {
  const b = await loadBooking(bookingId);
  if (!b) return { ok: false, code: "notfound", message: "Booking not found" };
  if (b.customer_id !== customerId)
    return { ok: false, code: "forbidden", message: "Only the customer can pay for this booking." };
  if (b.status !== "accepted")
    return {
      ok: false,
      code: "conflict",
      message: "Payment opens once the walker accepts the booking.",
    };

  const existing = await loadPayment(bookingId);
  if (existing && (existing.status === "held" || existing.status === "captured")) {
    return { ok: false, code: "alreadypaid", message: "This booking is already paid." };
  }

  const provider = getProvider(b.currency);
  const amount = Number(b.quoted_total);
  const walkerPayout = Number(b.price_breakdown?.walkerPayout ?? 0);
  const commission = Math.round((amount - walkerPayout) * 100) / 100;

  // Stable idempotency key: retries within Stripe's window return the SAME
  // PaymentIntent (and client secret), so double-taps never double-charge.
  const auth = await provider.authorize({
    bookingId,
    amount,
    currency: b.currency,
    idempotencyKey: `booking:${bookingId}:auth`,
    metadata: { customerId, walkerId: b.walker_id },
  });
  if (!auth.clientSecret) {
    return { ok: false, code: "conflict", message: "Could not start payment. Please try again." };
  }

  // Upsert the single payments row (pending until the webhook confirms the hold).
  await query(
    `INSERT INTO payments
       (booking_id, provider, method, currency, amount, platform_commission, walker_payout, status, provider_ref)
     VALUES ($1, $2, 'card', $3, $4, $5, $6, 'pending', $7)
     ON CONFLICT (booking_id) DO UPDATE
       SET provider = EXCLUDED.provider,
           amount = EXCLUDED.amount,
           platform_commission = EXCLUDED.platform_commission,
           walker_payout = EXCLUDED.walker_payout,
           provider_ref = EXCLUDED.provider_ref,
           status = 'pending'`,
    [bookingId, provider.name, b.currency, amount, commission, walkerPayout, auth.providerRef]
  );

  return {
    ok: true,
    intent: {
      clientSecret: auth.clientSecret,
      publishableKey: getPublishableKey(),
      providerRef: auth.providerRef,
      amount,
      currency: b.currency,
    },
  };
}

export interface ManualPaymentResult {
  method: ManualMethod;
  /** Reconciliation reference the customer quotes when paying (null for cash). */
  reference: string | null;
  /** Destination handle to pay into (null for cash — settled in person). */
  destination: string | null;
  amount: number;
  currency: string;
}

/**
 * Commit a booking to a manual rail (Whish / OMT / BOB) or to cash. No money
 * moves here: the manual rails mint a reference the customer pays against
 * out-of-band (admin confirms receipt later), and cash is collected by the
 * walker at the walk. Same ownership/status guards as the card intent flow.
 */
export async function createManualPayment(
  bookingId: string,
  customerId: string,
  method: ManualMethod
): Promise<
  | { ok: true; payment: ManualPaymentResult }
  | { ok: false; code: "notfound" | "forbidden" | "conflict" | "alreadypaid"; message: string }
> {
  const b = await loadBooking(bookingId);
  if (!b) return { ok: false, code: "notfound", message: "Booking not found" };
  if (b.customer_id !== customerId)
    return { ok: false, code: "forbidden", message: "Only the customer can pay for this booking." };
  if (b.status !== "accepted")
    return {
      ok: false,
      code: "conflict",
      message: "Payment opens once the walker accepts the booking.",
    };

  const existing = await loadPayment(bookingId);
  if (existing && (existing.status === "held" || existing.status === "captured")) {
    return { ok: false, code: "alreadypaid", message: "This booking is already paid." };
  }

  const amount = Number(b.quoted_total);
  const walkerPayout = Number(b.price_breakdown?.walkerPayout ?? 0);
  const commission = Math.round((amount - walkerPayout) * 100) / 100;

  // Cash never touches an adapter; the manual rails mint a reconciliation ref.
  let reference: string | null = null;
  if (method !== "cash") {
    const auth = await getProviderByName(method).authorize({
      bookingId,
      amount,
      currency: b.currency,
      idempotencyKey: `booking:${bookingId}:${method}`,
      metadata: { customerId, walkerId: b.walker_id },
    });
    reference = auth.providerRef;
  }

  // Switching rails re-opens the same single row at pending, clearing any prior
  // "I've sent it" marker so a fresh manual payment starts clean.
  await query(
    `INSERT INTO payments
       (booking_id, provider, method, currency, amount, platform_commission, walker_payout, status, provider_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
     ON CONFLICT (booking_id) DO UPDATE
       SET provider = EXCLUDED.provider,
           method = EXCLUDED.method,
           amount = EXCLUDED.amount,
           platform_commission = EXCLUDED.platform_commission,
           walker_payout = EXCLUDED.walker_payout,
           provider_ref = EXCLUDED.provider_ref,
           payer_marked_paid_at = NULL,
           status = 'pending'`,
    [bookingId, method, METHOD_COLUMN[method], b.currency, amount, commission, walkerPayout, reference]
  );

  return {
    ok: true,
    payment: {
      method,
      reference,
      destination: await railDestination(method),
      amount,
      currency: b.currency,
    },
  };
}

/**
 * Customer self-reports "I've sent the money" on a manual rail. Stamps the row
 * so it enters the admin confirmation queue; admin confirming flips it to held.
 * Only valid on a manual-rail payment that is still pending.
 */
export async function markPayerPaid(
  bookingId: string,
  customerId: string
): Promise<{ ok: true } | { ok: false; code: "notfound" | "forbidden" | "conflict"; message: string }> {
  const b = await loadBooking(bookingId);
  if (!b) return { ok: false, code: "notfound", message: "Booking not found" };
  if (b.customer_id !== customerId)
    return { ok: false, code: "forbidden", message: "Only the customer can confirm payment." };

  const p = await loadPayment(bookingId);
  if (!p || p.provider === "cash" || p.method === "card")
    return { ok: false, code: "conflict", message: "No manual payment to confirm for this booking." };
  if (p.status !== "pending")
    return { ok: false, code: "conflict", message: "This payment is already being processed." };

  await query(
    "UPDATE payments SET payer_marked_paid_at = COALESCE(payer_marked_paid_at, now()) WHERE id = $1",
    [p.id]
  );
  return { ok: true };
}

/**
 * Admin confirms a manual-rail payment was received: pending → held. From here
 * the booking behaves like any held payment (walk can start; capture on
 * completion is a no-op that just marks it captured). Idempotent.
 */
export async function confirmManualReceipt(
  bookingId: string
): Promise<{ ok: true } | { ok: false; code: "notfound" | "conflict"; message: string }> {
  const p = await loadPayment(bookingId);
  if (!p) return { ok: false, code: "notfound", message: "No payment found for this booking." };
  if (p.method === "card")
    return { ok: false, code: "conflict", message: "Card payments confirm automatically." };
  if (p.status === "held" || p.status === "captured") return { ok: true };
  if (p.status !== "pending")
    return { ok: false, code: "conflict", message: "This payment can't be confirmed." };

  await query("UPDATE payments SET status = 'held' WHERE id = $1 AND status = 'pending'", [p.id]);
  return { ok: true };
}

/** Hours the walker payout is held after capture so the customer can dispute. */
async function payoutReviewHours(): Promise<number> {
  const r = await query<{ payout_review_hours: number }>(
    "SELECT payout_review_hours FROM platform_config WHERE id = 1"
  );
  return r.rows[0]?.payout_review_hours ?? 24;
}

/**
 * Capture the held funds when a walk completes. No-op if unpaid/already captured.
 * Capturing charges the customer, but the walker's payout is NOT released yet:
 * we stamp payout_eligible_at = now + review window so a payout batch can only
 * pay out once the dispute window has passed (and no dispute is open).
 */
export async function captureForBooking(bookingId: string): Promise<boolean> {
  const p = await loadPayment(bookingId);
  if (!p) return false;
  if (p.status === "captured") return true;

  // Cash is settled in person: the walker already holds the full amount, so
  // "capture" records the commission the walker owes the platform (netted from a
  // later online payout) and marks the row captured. No gateway, no held state —
  // cash goes straight pending → captured on completion.
  if (p.provider === "cash") {
    if (p.status !== "pending" && p.status !== "held") return false;
    const b = await loadBooking(bookingId);
    const commission = Number(p.platform_commission);
    if (b && commission > 0) {
      // Idempotent: uq_walker_ledger_cash_commission guards double-runs.
      await query(
        `INSERT INTO walker_ledger (walker_id, booking_id, entry_type, amount, currency, note)
         VALUES ($1, $2, 'cash_commission_due', $3, $4, 'Commission on cash booking')
         ON CONFLICT (booking_id) WHERE entry_type = 'cash_commission_due' DO NOTHING`,
        [b.walker_id, bookingId, commission, p.currency]
      );
    }
    const cashHours = await payoutReviewHours();
    await query(
      `UPDATE payments
          SET status = 'captured',
              captured_at = now(),
              payout_eligible_at = now() + ($2 || ' hours')::interval
        WHERE id = $1`,
      [p.id, String(cashHours)]
    );
    return true;
  }

  if (!p.provider_ref) return false;
  if (p.status !== "held") return false;

  await getProviderByName(p.provider).capture(p.provider_ref);
  const hours = await payoutReviewHours();
  await query(
    `UPDATE payments
        SET status = 'captured',
            captured_at = now(),
            payout_eligible_at = now() + ($2 || ' hours')::interval
      WHERE id = $1`,
    [p.id, String(hours)]
  );
  return true;
}

/**
 * Back out the commission a walker owed on a now-refunded cash booking: post a
 * negative payout_offset so the ledger nets to zero and the walker isn't billed
 * for a booking the customer got money back on. Idempotent per booking.
 */
async function reverseCashCommission(
  bookingId: string,
  p: PaymentRow,
  reason: string
): Promise<void> {
  const commission = Number(p.platform_commission);
  if (!(commission > 0)) return;
  const b = await loadBooking(bookingId);
  if (!b) return;
  await query(
    `INSERT INTO walker_ledger (walker_id, booking_id, entry_type, amount, currency, note)
       SELECT $1, $2, 'payout_offset', $3, $4, $5
        WHERE NOT EXISTS (
          SELECT 1 FROM walker_ledger
           WHERE booking_id = $2 AND entry_type = 'payout_offset'
        )`,
    [b.walker_id, bookingId, -commission, p.currency, `Reversed cash commission (${reason})`]
  );
}

interface CancelTiers {
  free_cancel_hours: number;
  late_cancel_refund_pct: string;
}

/** Fraction of the total to refund given how far ahead of start_at we cancel. */
function refundFraction(startAt: string, tiers: CancelTiers): number {
  const hoursUntilStart = (new Date(startAt).getTime() - Date.now()) / 3_600_000;
  if (hoursUntilStart >= tiers.free_cancel_hours) return 1; // free cancellation
  return Number(tiers.late_cancel_refund_pct); // partial refund window
}

/**
 * On cancel / decline / expire: void the hold if not yet captured, or refund a
 * captured charge per the cancellation tiers (free ≥ free_cancel_hours, else
 * late_cancel_refund_pct). Safe to call when there's no payment.
 */
export async function voidOrRefundForBooking(
  bookingId: string,
  reason: string
): Promise<void> {
  const p = await loadPayment(bookingId);
  if (!p) return;

  // Cash moves no money through an adapter. Before completion there's nothing to
  // reverse — just close the row. After completion (captured) the walker held the
  // cash and owed us commission, so we back out that commission with an offset.
  if (p.provider === "cash") {
    if (p.status === "pending" || p.status === "held") {
      await query(
        "UPDATE payments SET status = 'refunded', refunded_amount = 0, refunded_at = now() WHERE id = $1",
        [p.id]
      );
    } else if (p.status === "captured") {
      await reverseCashCommission(bookingId, p, reason);
      await query(
        "UPDATE payments SET status = 'refunded', refunded_amount = $2, refunded_at = now() WHERE id = $1",
        [p.id, Number(p.amount)]
      );
    }
    return;
  }

  if (!p.provider_ref) return;
  const provider = getProviderByName(p.provider);

  if (p.status === "held") {
    await provider.voidAuthorization(p.provider_ref);
    await query(
      "UPDATE payments SET status = 'refunded', refunded_amount = 0, refunded_at = now() WHERE id = $1",
      [p.id]
    );
    return;
  }

  if (p.status === "captured") {
    const b = await loadBooking(bookingId);
    const t = await query<CancelTiers>(
      "SELECT free_cancel_hours, late_cancel_refund_pct FROM platform_config WHERE id = 1"
    );
    const tiers = t.rows[0] ?? { free_cancel_hours: 24, late_cancel_refund_pct: "0.5" };
    const fraction = b ? refundFraction(b.start_at, tiers) : 1;
    const refundAmount = Math.round(Number(p.amount) * fraction * 100) / 100;
    if (refundAmount > 0) {
      await provider.refund({
        providerRef: p.provider_ref,
        amount: refundAmount,
        currency: p.currency,
        reason,
      });
    }
    await query(
      "UPDATE payments SET status = 'refunded', refunded_amount = $2, refunded_at = now() WHERE id = $1",
      [p.id, refundAmount]
    );
  }
}

/**
 * Refund a specific amount on a captured charge — used by admin dispute
 * resolution (which decides the amount), not the automatic cancellation tiers.
 * Safe no-op when payments aren't configured, the booking has no payment, or the
 * charge isn't captured. A refund covering the full amount marks the row
 * 'refunded' (so it drops out of payout eligibility); a partial refund leaves the
 * row 'captured' but records refunded_amount.
 */
export async function refundCapturedForBooking(
  bookingId: string,
  amount: number
): Promise<boolean> {
  if (amount <= 0) return false;
  const p = await loadPayment(bookingId);
  if (!p) return false;
  if (p.status !== "captured") return false;

  const full = amount >= Number(p.amount);

  // Cash: no gateway to refund. Reverse the walker's commission (a full refund
  // zeroes what they owed) and mark the row so it drops out of payout eligibility.
  if (p.provider === "cash") {
    if (full) await reverseCashCommission(bookingId, p, "dispute");
    await query(
      `UPDATE payments
          SET status = CASE WHEN $3 THEN 'refunded' ELSE status END,
              refunded_amount = $2,
              refunded_at = now()
        WHERE id = $1`,
      [p.id, amount, full]
    );
    return true;
  }

  if (!p.provider_ref) return false;
  await getProviderByName(p.provider).refund({
    providerRef: p.provider_ref,
    amount,
    currency: p.currency,
    reason: "dispute",
  });
  await query(
    `UPDATE payments
        SET status = CASE WHEN $3 THEN 'refunded' ELSE status END,
            refunded_amount = $2,
            refunded_at = now()
      WHERE id = $1`,
    [p.id, amount, full]
  );
  return true;
}

/**
 * Fault-based payout deduction. When a dispute is resolved with a refund AND the
 * walker is at fault, dock the walker's still-held payout in proportion to how
 * much of the booking total was refunded:
 *
 *   walker_deduction = round(refundAmount * walker_payout / total, 2)   (capped at walker_payout)
 *
 * A full refund zeroes the walker's payout (they earn nothing on a walk they
 * caused to be refunded); a partial refund docks proportionally. This is never a
 * clawback — the payout is still held through the review window, so the batch
 * simply releases (walker_payout - walker_deduction). Returns the amount docked.
 *
 * No-op (returns 0) when there is no payment row or no payout to dock, so it is
 * safe to call while a live payment provider is not yet configured.
 */
export async function chargeWalkerForRefund(
  bookingId: string,
  refundAmount: number
): Promise<number> {
  if (refundAmount <= 0) return 0;
  const r = await query<{ id: string; amount: string; walker_payout: string }>(
    `SELECT id, amount, walker_payout FROM payments WHERE booking_id = $1`,
    [bookingId]
  );
  const p = r.rows[0];
  if (!p) return 0;

  const total = Number(p.amount);
  const payout = Number(p.walker_payout);
  if (!(total > 0) || !(payout > 0)) return 0;

  const proportional = Math.round(((refundAmount * payout) / total) * 100) / 100;
  const deduction = Math.min(proportional, payout);
  if (deduction <= 0) return 0;

  await query(`UPDATE payments SET walker_deduction = $2, updated_at = now() WHERE id = $1`, [
    p.id,
    deduction,
  ]);
  return deduction;
}

/** Webhook side-effects: move the payment row to match the gateway's truth. */
export async function applyProviderEvent(
  type: "authorized" | "captured" | "refunded" | "failed" | "canceled",
  providerRef: string
): Promise<void> {
  switch (type) {
    case "authorized":
      await query(
        "UPDATE payments SET status = 'held' WHERE provider_ref = $1 AND status = 'pending'",
        [providerRef]
      );
      break;
    case "captured":
      await query(
        `UPDATE payments p
            SET status = 'captured',
                captured_at = COALESCE(p.captured_at, now()),
                payout_eligible_at = COALESCE(
                  p.payout_eligible_at,
                  now() + ((SELECT payout_review_hours FROM platform_config WHERE id = 1) || ' hours')::interval
                )
          WHERE p.provider_ref = $1 AND p.status <> 'refunded'`,
        [providerRef]
      );
      break;
    case "refunded":
      await query(
        "UPDATE payments SET status = 'refunded', refunded_at = COALESCE(refunded_at, now()) WHERE provider_ref = $1",
        [providerRef]
      );
      break;
    case "failed":
      await query(
        "UPDATE payments SET status = 'failed' WHERE provider_ref = $1 AND status = 'pending'",
        [providerRef]
      );
      break;
    case "canceled":
      await query(
        "UPDATE payments SET status = 'refunded', refunded_at = COALESCE(refunded_at, now()) WHERE provider_ref = $1 AND status IN ('pending','held')",
        [providerRef]
      );
      break;
  }
}
