import { Router } from "express";
import { ok, notFoundError, forbidden, conflict, unprocessable, fail } from "../lib/response.js";
import { query } from "../lib/db.js";
import { getPublishableKey, isPaymentsConfigured } from "../lib/payments/index.js";
import {
  createIntentForBooking,
  getPaymentView,
} from "../lib/payments/service.js";

/**
 * Customer-facing payment endpoints. Mounted behind requireAuth.
 *
 * The escrow flow the frontend drives:
 *   1. Walker accepts  → customer POSTs /intent to place an authorization HOLD.
 *   2. Frontend confirms the returned client secret with Stripe Elements.
 *   3. Capture/void/refund happen server-side off the booking lifecycle + webhooks.
 *
 * The Stripe webhook is NOT here — it needs the raw request body for signature
 * verification, so it's mounted in index.ts before express.json().
 */
export const paymentsRouter = Router();

/** GET /api/payments/config — publishable key the frontend needs to mount Elements. */
paymentsRouter.get("/config", (_req, res) => {
  return ok(res, {
    configured: isPaymentsConfigured(),
    publishableKey: getPublishableKey(),
  });
});

/** Both parties may read a booking's payment state; anyone else gets a 404. */
async function assertBookingParty(bookingId: string, uid: string, role: string) {
  const r = await query<{ customer_id: string; walker_id: string }>(
    "SELECT customer_id, walker_id FROM bookings WHERE id = $1",
    [bookingId]
  );
  const b = r.rows[0];
  if (!b) return "notfound" as const;
  if (b.customer_id !== uid && b.walker_id !== uid && role !== "admin") return "notfound" as const;
  return "ok" as const;
}

// GET /api/payments/bookings/:id — public payment state for a booking's parties.
paymentsRouter.get("/bookings/:id", async (req, res) => {
  const access = await assertBookingParty(req.params.id, req.user!.userId, req.user!.role);
  if (access === "notfound") return notFoundError(res, "Booking not found");
  const view = await getPaymentView(req.params.id);
  return ok(res, { payment: view });
});

// POST /api/payments/bookings/:id/intent — customer places (or re-fetches) the hold.
paymentsRouter.post("/bookings/:id/intent", async (req, res) => {
  if (!isPaymentsConfigured()) {
    return fail(res, "Payments aren't configured yet. Please try again later.", 503);
  }
  const result = await createIntentForBooking(req.params.id, req.user!.userId);
  if (!result.ok) {
    switch (result.code) {
      case "notfound":
        return notFoundError(res, result.message);
      case "forbidden":
        return forbidden(res, result.message);
      case "alreadypaid":
        return conflict(res, result.message);
      case "conflict":
        return conflict(res, result.message);
      default:
        return unprocessable(res, result.message);
    }
  }
  return ok(res, { intent: result.intent });
});
