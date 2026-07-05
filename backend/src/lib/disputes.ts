import { query } from "./db.js";
import { refundCapturedForBooking, chargeWalkerForRefund } from "./payments/service.js";

/**
 * Trust & safety: customer-raised disputes.
 *
 * A dispute is the structured alternative to "message support." Opening one:
 *   • records which booking + why (reason + optional note),
 *   • pauses the walker's payout (a payout batch skips bookings with an OPEN
 *     dispute — see payoutEligible SQL below), and
 *   • surfaces the walk's integrity flags (ended_early / missed_mid_photo) to
 *     whoever reviews it.
 *
 * Resolution (full/partial refund or denied) is an admin action — a later pass.
 * The charge itself is still captured on completion; only the payout is held.
 */

export type DisputeReason =
  | "ended_early"
  | "missing_photos"
  | "no_show"
  | "pet_welfare"
  | "other";

export interface DisputeView {
  id: string;
  reason: DisputeReason;
  note: string | null;
  status: "open" | "resolved" | "rejected";
  resolution: "refund_full" | "refund_partial" | "denied" | null;
  refundAmount: number;
  createdAt: string;
  resolvedAt: string | null;
}

interface DisputeRow {
  id: string;
  reason: DisputeReason;
  note: string | null;
  status: DisputeView["status"];
  resolution: DisputeView["resolution"];
  refund_amount: string;
  created_at: string;
  resolved_at: string | null;
}

function toView(r: DisputeRow): DisputeView {
  return {
    id: r.id,
    reason: r.reason,
    note: r.note,
    status: r.status,
    resolution: r.resolution,
    refundAmount: Number(r.refund_amount),
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

/** The current (open, else most recent) dispute for a booking, or null. */
export async function getDisputeForBooking(bookingId: string): Promise<DisputeView | null> {
  const r = await query<DisputeRow>(
    `SELECT id, reason, note, status, resolution, refund_amount, created_at, resolved_at
       FROM disputes
      WHERE booking_id = $1
      ORDER BY (status = 'open') DESC, created_at DESC
      LIMIT 1`,
    [bookingId]
  );
  return r.rows[0] ? toView(r.rows[0]) : null;
}

interface BookingParties {
  customer_id: string;
  walker_id: string;
  status: string;
  walker_first: string;
}

/**
 * Open a dispute on a booking. Only the customer may raise one, and only once
 * the walk is underway or done (nothing to dispute before it starts). At most
 * one OPEN dispute per booking (DB-enforced) — a second attempt is a conflict.
 */
export async function openDispute(
  bookingId: string,
  userId: string,
  reason: DisputeReason,
  note: string | null
): Promise<
  | { ok: true; dispute: DisputeView; walkerId: string; walkerFirst: string }
  | { ok: false; code: "notfound" | "forbidden" | "conflict"; message: string }
> {
  const r = await query<BookingParties>(
    `SELECT b.customer_id, b.walker_id, b.status, w.first_name AS walker_first
       FROM bookings b
       JOIN users w ON w.id = b.walker_id
      WHERE b.id = $1`,
    [bookingId]
  );
  const b = r.rows[0];
  if (!b) return { ok: false, code: "notfound", message: "Booking not found" };
  if (b.customer_id !== userId)
    return { ok: false, code: "forbidden", message: "Only the customer can report an issue on this booking." };
  if (b.status !== "in_progress" && b.status !== "completed") {
    return {
      ok: false,
      code: "conflict",
      message: "You can report an issue once the walk is underway or finished.",
    };
  }

  try {
    const ins = await query<DisputeRow>(
      `INSERT INTO disputes (booking_id, opened_by, reason, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reason, note, status, resolution, refund_amount, created_at, resolved_at`,
      [bookingId, userId, reason, note]
    );
    return {
      ok: true,
      dispute: toView(ins.rows[0]),
      walkerId: b.walker_id,
      walkerFirst: b.walker_first,
    };
  } catch (e) {
    // Unique partial index (one open dispute per booking) → already reported.
    if ((e as { code?: string }).code === "23505") {
      return { ok: false, code: "conflict", message: "You've already reported an issue for this booking." };
    }
    throw e;
  }
}

export type DisputeResolution = "refund_full" | "refund_partial" | "denied";

/** Admin queue row: the dispute plus the booking context needed to judge it. */
export interface AdminDisputeView extends DisputeView {
  bookingId: string;
  customerName: string;
  walkerName: string;
  serviceType: string;
  startAt: string;
  bookingStatus: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  refundedAmount: number;
  /** Whether the resolution held the walker at fault (refund docked from payout). */
  walkerLiable: boolean;
  /** How much of the walker's payout was docked for this refund. */
  walkerDeduction: number;
  /** Integrity signals from the walk — review INPUTS, never auto-verdicts. */
  endedEarly: boolean;
  missedMidPhoto: boolean;
}

interface AdminDisputeRow {
  id: string;
  reason: DisputeReason;
  note: string | null;
  status: DisputeView["status"];
  resolution: DisputeView["resolution"];
  refund_amount: string;
  created_at: string;
  resolved_at: string | null;
  booking_id: string;
  customer_name: string;
  walker_name: string;
  service_type: string;
  start_at: string;
  booking_status: string;
  amount: string;
  currency: string;
  payment_status: string | null;
  payment_refunded: string | null;
  walker_liable: boolean;
  walker_deduction: string | null;
  ended_early: boolean;
  missed_mid_photo: boolean;
}

/** Disputes for the admin queue, newest first. Filter by status (default open). */
export async function listDisputes(status?: string): Promise<AdminDisputeView[]> {
  const rows = await query<AdminDisputeRow>(
    `SELECT d.id, d.reason, d.note, d.status, d.resolution, d.refund_amount,
            d.created_at, d.resolved_at, d.booking_id,
            (cu.first_name || ' ' || cu.last_name) AS customer_name,
            (wu.first_name || ' ' || wu.last_name) AS walker_name,
            b.service_type, b.start_at, b.status AS booking_status,
            b.quoted_total AS amount, b.currency,
            p.status AS payment_status, p.refunded_amount AS payment_refunded,
            p.walker_deduction, d.walker_liable,
            b.ended_early, b.missed_mid_photo
       FROM disputes d
       JOIN bookings b ON b.id = d.booking_id
       JOIN users cu ON cu.id = b.customer_id
       JOIN users wu ON wu.id = b.walker_id
       LEFT JOIN payments p ON p.booking_id = b.id
      ${status ? "WHERE d.status = $1" : ""}
      ORDER BY (d.status = 'open') DESC, d.created_at DESC
      LIMIT 200`,
    status ? [status] : []
  );
  return rows.rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    note: r.note,
    status: r.status,
    resolution: r.resolution,
    refundAmount: Number(r.refund_amount),
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    bookingId: r.booking_id,
    customerName: r.customer_name,
    walkerName: r.walker_name,
    serviceType: r.service_type,
    startAt: r.start_at,
    bookingStatus: r.booking_status,
    amount: Number(r.amount),
    currency: r.currency,
    paymentStatus: r.payment_status ?? "none",
    refundedAmount: Number(r.payment_refunded ?? 0),
    walkerLiable: r.walker_liable,
    walkerDeduction: Number(r.walker_deduction ?? 0),
    endedEarly: r.ended_early,
    missedMidPhoto: r.missed_mid_photo,
  }));
}

/**
 * Admin resolves an OPEN dispute. `refund_full` refunds the whole charge,
 * `refund_partial` refunds the given amount (0 < amount < total), `denied`
 * upholds the booking (no refund). Marking the dispute non-open is what lifts the
 * payout hold — a `denied` booking becomes payout-eligible again; a full refund
 * flips the payment to 'refunded' so it never pays out. The actual money-move is
 * a no-op until a live payment provider is configured, but the verdict is
 * recorded either way.
 */
export async function resolveDispute(
  disputeId: string,
  adminId: string,
  resolution: DisputeResolution,
  refundAmountInput?: number,
  walkerLiable = true
): Promise<
  | { ok: true; dispute: DisputeView; customerId: string; walkerId: string; bookingId: string }
  | { ok: false; code: "notfound" | "conflict" | "unprocessable"; message: string }
> {
  const r = await query<{
    status: string;
    booking_id: string;
    customer_id: string;
    walker_id: string;
    amount: string;
  }>(
    `SELECT d.status, d.booking_id, b.customer_id, b.walker_id, b.quoted_total AS amount
       FROM disputes d
       JOIN bookings b ON b.id = d.booking_id
      WHERE d.id = $1`,
    [disputeId]
  );
  const row = r.rows[0];
  if (!row) return { ok: false, code: "notfound", message: "Dispute not found" };
  if (row.status !== "open")
    return { ok: false, code: "conflict", message: "This dispute has already been resolved." };

  const total = Number(row.amount);
  let refundAmount = 0;
  let newStatus: "resolved" | "rejected";
  if (resolution === "refund_full") {
    refundAmount = total;
    newStatus = "resolved";
  } else if (resolution === "refund_partial") {
    refundAmount = Math.round((refundAmountInput ?? 0) * 100) / 100;
    if (!(refundAmount > 0 && refundAmount < total))
      return {
        ok: false,
        code: "unprocessable",
        message: `Partial refund must be between 0 and ${total.toFixed(2)}.`,
      };
    newStatus = "resolved";
  } else {
    refundAmount = 0;
    newStatus = "rejected";
  }

  // A denied dispute never touches the walker's payout, so liability only applies
  // to refunds. When the walker is at fault, the refund is docked from their
  // still-held payout; when it's platform goodwill (walkerLiable=false) the walker
  // is paid in full and the platform absorbs the refund.
  const liable = refundAmount > 0 ? walkerLiable : false;
  if (refundAmount > 0) {
    await refundCapturedForBooking(row.booking_id, refundAmount);
    if (liable) await chargeWalkerForRefund(row.booking_id, refundAmount);
  }

  const upd = await query<DisputeRow>(
    `UPDATE disputes
        SET status = $2, resolution = $3, refund_amount = $4,
            walker_liable = $6, resolved_by = $5, resolved_at = now()
      WHERE id = $1
      RETURNING id, reason, note, status, resolution, refund_amount, created_at, resolved_at`,
    [disputeId, newStatus, resolution, refundAmount, adminId, liable]
  );
  return {
    ok: true,
    dispute: toView(upd.rows[0]),
    customerId: row.customer_id,
    walkerId: row.walker_id,
    bookingId: row.booking_id,
  };
}

/**
 * Payments whose walker payout may now be released: captured, past the review
 * window, not already paid out, and with no OPEN dispute. This is the query a
 * back-office / batched payout run consumes so the dispute hold is actually
 * enforced (a captured charge alone is never enough to pay the walker).
 */
export async function listPayoutEligiblePayments(limit = 500): Promise<
  { paymentId: string; bookingId: string; walkerPayout: number; currency: string }[]
> {
  const r = await query<{
    id: string;
    booking_id: string;
    walker_payout: string;
    walker_deduction: string;
    currency: string;
  }>(
    // net_payout = walker_payout - walker_deduction (fault-based refund dock).
    // Rows fully docked to zero are dropped — nothing to release.
    `SELECT p.id, p.booking_id, p.walker_payout, p.walker_deduction, p.currency
       FROM payments p
      WHERE p.status = 'captured'
        AND p.payout_id IS NULL
        AND p.payout_eligible_at IS NOT NULL
        AND p.payout_eligible_at <= now()
        AND (p.walker_payout - p.walker_deduction) > 0
        AND NOT EXISTS (
          SELECT 1 FROM disputes d
           WHERE d.booking_id = p.booking_id AND d.status = 'open'
        )
      ORDER BY p.payout_eligible_at ASC
      LIMIT $1`,
    [limit]
  );
  return r.rows.map((row) => ({
    paymentId: row.id,
    bookingId: row.booking_id,
    walkerPayout: Number(row.walker_payout) - Number(row.walker_deduction),
    currency: row.currency,
  }));
}
