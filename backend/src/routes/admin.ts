import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { ok, notFoundError, unprocessable, conflict } from "../lib/response.js";
import { query } from "../lib/db.js";
import { listDisputes, resolveDispute } from "../lib/disputes.js";
import { confirmManualReceipt } from "../lib/payments/service.js";
import { notify } from "../lib/realtime.js";

// Mounted behind requireAuth + requireRole("admin").
export const adminRouter = Router();

const USER_COLS = `
  id, role, first_name AS "firstName", last_name AS "lastName", email,
  verification_status AS "verificationStatus",
  verification_doc_type AS "docType",
  (verification_doc_url IS NOT NULL)    AS "hasDoc",
  (verification_selfie_url IS NOT NULL) AS "hasSelfie",
  created_at AS "createdAt"
`;

// GET /api/admin/users?status=pending
adminRouter.get("/users", async (req, res) => {
  const status = req.query.status as string | undefined;
  const result = status
    ? await query(
        `SELECT ${USER_COLS} FROM users WHERE verification_status = $1 ORDER BY created_at DESC LIMIT 200`,
        [status]
      )
    : await query(`SELECT ${USER_COLS} FROM users ORDER BY created_at DESC LIMIT 200`);
  return ok(res, { users: result.rows });
});

function privatePath(ref: string | null): string | null {
  if (!ref) return null;
  const filename = ref.split("/").pop();
  if (!filename) return null;
  const resolved = path.resolve("private_uploads", filename);
  // Guard against path traversal — must stay inside private_uploads.
  if (!resolved.startsWith(path.resolve("private_uploads"))) return null;
  return fs.existsSync(resolved) ? resolved : null;
}

// GET /api/admin/users/:id/file/:kind  (kind = document | selfie)
// Streams the private verification image to admins for manual face-match.
adminRouter.get("/users/:id/file/:kind", async (req, res) => {
  const kind = req.params.kind;
  if (kind !== "document" && kind !== "selfie") return notFoundError(res, "Unknown file");
  const col = kind === "document" ? "verification_doc_url" : "verification_selfie_url";
  const r = await query<{ ref: string | null }>(
    `SELECT ${col} AS ref FROM users WHERE id = $1`,
    [req.params.id]
  );
  const fp = privatePath(r.rows[0]?.ref ?? null);
  if (!fp) return notFoundError(res, "File not found");
  return res.sendFile(fp);
});

// PATCH /api/admin/users/:id/verify
const verifySchema = z.object({ status: z.enum(["verified", "rejected"]) });

adminRouter.patch("/users/:id/verify", async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return unprocessable(res, "Status must be 'verified' or 'rejected'.");
  const result = await query(
    `UPDATE users SET verification_status = $1
      WHERE id = $2 AND role = 'walker'
      RETURNING id, verification_status AS "verificationStatus"`,
    [parsed.data.status, req.params.id]
  );
  if (!result.rowCount) return notFoundError(res, "Walker not found");
  return ok(res, { user: result.rows[0] }, `Walker ${parsed.data.status}`);
});

// GET /api/admin/disputes?status=open  — the trust & safety review queue.
adminRouter.get("/disputes", async (req, res) => {
  const status = req.query.status as string | undefined;
  const disputes = await listDisputes(status);
  return ok(res, { disputes });
});

// PATCH /api/admin/disputes/:id/resolve — decide a dispute (refund / deny).
const resolveSchema = z.object({
  resolution: z.enum(["refund_full", "refund_partial", "denied"]),
  refundAmount: z.number().positive().optional(),
  // Defaults to true (walker at fault → refund docked from payout). Set false for
  // platform goodwill: the walker keeps their full payout and the platform absorbs it.
  walkerLiable: z.boolean().optional(),
});

adminRouter.patch("/disputes/:id/resolve", async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return unprocessable(res, "Choose a valid resolution.");

  const result = await resolveDispute(
    req.params.id,
    req.user!.userId,
    parsed.data.resolution,
    parsed.data.refundAmount,
    parsed.data.walkerLiable ?? true
  );
  if (!result.ok) {
    if (result.code === "notfound") return notFoundError(res, result.message);
    if (result.code === "conflict") return conflict(res, result.message);
    return unprocessable(res, result.message);
  }

  // Tell both parties the outcome (neutral, factual copy).
  const refunded = result.dispute.refundAmount > 0;
  const outcome = refunded
    ? `A refund of ${result.dispute.refundAmount.toFixed(2)} was issued.`
    : "After review, the booking was found to be completed as agreed.";
  await notify({
    userId: result.customerId,
    type: "dispute_resolved",
    title: "Your reported issue was reviewed",
    body: outcome,
    bookingId: result.bookingId,
  });
  await notify({
    userId: result.walkerId,
    type: "dispute_resolved",
    title: "A reported issue was resolved",
    body: refunded
      ? "The customer was issued a refund after review."
      : "The booking was found to be completed as agreed.",
    bookingId: result.bookingId,
  });

  return ok(res, { dispute: result.dispute }, "Dispute resolved");
});

// GET /api/admin/payments/pending — manual-rail payments the customer says they've
// sent (payer_marked_paid_at set) but that an admin hasn't confirmed received yet.
adminRouter.get("/payments/pending", async (_req, res) => {
  const r = await query(
    `SELECT p.booking_id     AS "bookingId",
            p.provider,
            p.amount,
            p.currency,
            p.provider_ref   AS "reference",
            p.payer_marked_paid_at AS "markedPaidAt",
            cu.first_name || ' ' || cu.last_name AS "customerName",
            wu.first_name || ' ' || wu.last_name AS "walkerName"
       FROM payments p
       JOIN bookings b ON b.id = p.booking_id
       JOIN users cu ON cu.id = b.customer_id
       JOIN users wu ON wu.id = b.walker_id
      WHERE p.method IN ('cash_in', 'transfer')
        AND p.status = 'pending'
        AND p.payer_marked_paid_at IS NOT NULL
      ORDER BY p.payer_marked_paid_at ASC
      LIMIT 200`
  );
  return ok(res, { payments: r.rows });
});

// POST /api/admin/payments/:bookingId/confirm — admin confirms receipt of a manual
// payment (Whish / OMT / BOB): flips the payment pending → held so the walk can run.
adminRouter.post("/payments/:bookingId/confirm", async (req, res) => {
  const result = await confirmManualReceipt(req.params.bookingId);
  if (!result.ok) {
    if (result.code === "notfound") return notFoundError(res, result.message);
    return conflict(res, result.message);
  }
  const r = await query<{ customer_id: string }>(
    "SELECT customer_id FROM bookings WHERE id = $1",
    [req.params.bookingId]
  );
  if (r.rows[0]) {
    await notify({
      userId: r.rows[0].customer_id,
      type: "payment_received",
      title: "Payment confirmed",
      body: "We've confirmed your payment — your booking is secured.",
      bookingId: req.params.bookingId,
    });
  }
  return ok(res, { confirmed: true }, "Payment confirmed");
});
