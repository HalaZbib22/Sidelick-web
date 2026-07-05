import { Router } from "express";
import { z } from "zod";
import { ok, notFoundError, unprocessable, forbidden, conflict } from "../lib/response.js";
import { query } from "../lib/db.js";
import { notify } from "../lib/realtime.js";

// Mounted behind requireAuth.
export const reviewsRouter = Router();

const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

interface BookingRow {
  id: string;
  status: string;
  customer_id: string;
  walker_id: string;
  reviewer_first: string;
}

/** Load a booking and confirm the caller is its customer and it's completed. */
async function loadReviewableBooking(bookingId: string, uid: string) {
  const r = await query<BookingRow>(
    `SELECT b.id, b.status, b.customer_id, b.walker_id,
            cu.first_name AS reviewer_first
       FROM bookings b
       JOIN users cu ON cu.id = b.customer_id
      WHERE b.id = $1`,
    [bookingId]
  );
  const b = r.rows[0];
  if (!b) return { error: "notfound" as const };
  // Privacy: only the parties of the booking should learn anything about it.
  if (b.customer_id !== uid && b.walker_id !== uid) return { error: "notfound" as const };
  // Only the customer reviews the walker, and only after completion.
  if (b.customer_id !== uid) return { error: "forbidden" as const };
  if (b.status !== "completed") return { error: "not_completed" as const };
  return { ok: true as const, booking: b };
}

// POST /api/reviews — customer reviews the walker on a completed booking.
reviewsRouter.post("/", async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return unprocessable(res, "Please add a rating.", parsed.error.flatten());
  const { bookingId, rating, comment } = parsed.data;
  const uid = req.user!.userId;

  const loaded = await loadReviewableBooking(bookingId, uid);
  if (loaded.error === "notfound") return notFoundError(res, "Booking not found");
  if (loaded.error === "forbidden") return forbidden(res, "Only the pet owner can review this walker.");
  if (loaded.error === "not_completed")
    return unprocessable(res, "You can only review a booking after it's completed.");

  const { booking } = loaded;
  try {
    const r = await query<{ id: string }>(
      `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [booking.id, uid, booking.walker_id, rating, comment ?? null]
    );
    await notify({
      userId: booking.walker_id,
      type: "review_received",
      title: `New ${rating}★ review`,
      body: comment
        ? `${booking.reviewer_first}: "${comment.slice(0, 80)}"`
        : `${booking.reviewer_first} rated your walk.`,
      bookingId: booking.id,
      data: { rating },
    });
    return ok(res, { review: { id: r.rows[0].id } }, "Review submitted", 201);
  } catch (e) {
    // Unique (booking_id, reviewer_id) violation → already reviewed.
    if (e && typeof e === "object" && (e as { code?: string }).code === "23505") {
      return conflict(res, "You've already reviewed this booking.");
    }
    throw e;
  }
});

// GET /api/reviews/walker/:id — public reviews for a walker + aggregate.
reviewsRouter.get("/walker/:id", async (req, res) => {
  const r = await query(
    `SELECT rv.id, rv.rating, rv.comment, rv.created_at AS "createdAt",
            u.first_name AS "reviewerFirst", left(u.last_name, 1) AS "reviewerInitial"
       FROM reviews rv
       JOIN users u ON u.id = rv.reviewer_id
      WHERE rv.reviewee_id = $1
      ORDER BY rv.created_at DESC
      LIMIT 100`,
    [req.params.id]
  );
  const reviews = r.rows.map((rv: Record<string, unknown>) => ({
    id: rv.id,
    rating: rv.rating,
    comment: rv.comment ?? null,
    createdAt: rv.createdAt,
    reviewerName: `${rv.reviewerFirst} ${String(rv.reviewerInitial)}.`,
  }));
  const count = reviews.length;
  const average =
    count > 0 ? reviews.reduce((s, rv) => s + Number(rv.rating), 0) / count : 0;
  return ok(res, { reviews, ratingAvg: average, ratingCount: count });
});

// GET /api/reviews/booking/:bookingId — caller's review state for a booking.
reviewsRouter.get("/booking/:bookingId", async (req, res) => {
  const uid = req.user!.userId;
  const loaded = await loadReviewableBooking(req.params.bookingId, uid);
  if (loaded.error === "notfound") return notFoundError(res, "Booking not found");
  // Walker viewing their own completed booking, or not-yet-completed: not eligible, no review of theirs.
  if (loaded.error === "forbidden" || loaded.error === "not_completed") {
    return ok(res, { eligible: false, review: null });
  }

  const r = await query(
    `SELECT id, rating, comment, created_at AS "createdAt"
       FROM reviews WHERE booking_id = $1 AND reviewer_id = $2`,
    [req.params.bookingId, uid]
  );
  const review = r.rows[0]
    ? {
        id: r.rows[0].id,
        rating: r.rows[0].rating,
        comment: r.rows[0].comment ?? null,
        createdAt: r.rows[0].createdAt,
      }
    : null;
  return ok(res, { eligible: !review, review });
});
