import { query } from "../db.js";
import { getProvider, getPublishableKey } from "./index.js";

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
  amount: string;
  currency: string;
  refunded_amount: string;
  provider_ref: string | null;
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
    `SELECT id, status, amount, currency, refunded_amount, provider_ref
       FROM payments WHERE booking_id = $1`,
    [bookingId]
  );
  return r.rows[0] ?? null;
}

/** A booking is "paid enough" to start once funds are held or already captured. */
export async function isBookingPaid(bookingId: string): Promise<boolean> {
  const p = await loadPayment(bookingId);
  return !!p && (p.status === "held" || p.status === "captured");
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
    };
  }
  return {
    status: p.status as PaymentView["status"],
    amount: Number(p.amount),
    currency: p.currency,
    refundedAmount: Number(p.refunded_amount),
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
  if (!p || !p.provider_ref) return false;
  if (p.status === "captured") return true;
  if (p.status !== "held") return false;

  const b = await loadBooking(bookingId);
  await getProvider(b?.currency).capture(p.provider_ref);
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
  if (!p || !p.provider_ref) return;
  const provider = getProvider(p.currency);

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
  if (!p || !p.provider_ref) return false;
  if (p.status !== "captured") return false;

  const full = amount >= Number(p.amount);
  await getProvider(p.currency).refund({
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
