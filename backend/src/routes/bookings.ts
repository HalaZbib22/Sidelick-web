import { Router } from "express";
import { z } from "zod";
import type { PoolClient } from "pg";
import { ok, notFoundError, unprocessable, forbidden, conflict } from "../lib/response.js";
import { query, pool } from "../lib/db.js";
import { computeQuote, type QuoteInput, type Quote } from "../lib/pricing.js";
import { requireVerifiedWalker } from "../middleware/auth.js";
import { imageUpload, privateRef, resolvePrivateFile } from "../lib/uploads.js";
import { notify } from "../lib/realtime.js";
import { RESPONSE_WINDOW_MINUTES } from "../lib/expiry.js";
import {
  isBookingPaid,
  captureForBooking,
  voidOrRefundForBooking,
} from "../lib/payments/service.js";
import { isPaymentsConfigured } from "../lib/payments/index.js";
import { openDispute, getDisputeForBooking } from "../lib/disputes.js";

// Mounted behind requireAuth.
export const bookingsRouter = Router();

// Live walk/sit photos. External checkpoint names map to booking_checkins.type.
const photoUpload = imageUpload();
const CHECKPOINT_TO_DB = { start: "start", mid: "during", end: "end" } as const;
const DB_TO_CHECKPOINT = { start: "start", during: "mid", end: "end" } as const;
type Checkpoint = keyof typeof CHECKPOINT_TO_DB;

/** Insert or replace a booking's photo for one checkpoint (taken_at = server now). */
async function storeCheckpoint(bookingId: string, dbType: string, ref: string) {
  await query(
    `INSERT INTO booking_checkins (booking_id, type, photo_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (booking_id, type)
       DO UPDATE SET photo_url = EXCLUDED.photo_url, created_at = now()`,
    [bookingId, dbType, ref]
  );
}

/** Returns the booking parties if the caller may view it, else null (privacy). */
async function loadBookingForViewer(bookingId: string, uid: string, role: string) {
  const r = await query<{ customer_id: string; walker_id: string }>(
    "SELECT customer_id, walker_id FROM bookings WHERE id = $1",
    [bookingId]
  );
  const b = r.rows[0];
  if (!b) return null;
  if (b.customer_id !== uid && b.walker_id !== uid && role !== "admin") return null;
  return b;
}

// Optional recurrence: repeats the same booking weekly/monthly for N occurrences.
const recurrenceSchema = z.object({
  frequency: z.enum(["weekly", "monthly"]),
  interval: z.coerce.number().int().min(1).max(4).default(1),
  count: z.coerce.number().int().min(2).max(26),
});
type Recurrence = z.infer<typeof recurrenceSchema>;

const bookingSchema = z.object({
  walkerId: z.string().uuid(),
  serviceType: z.enum(["walk", "sit", "walk_sit"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  walkDurationMinutes: z.coerce.number().int().min(15).max(240).optional(),
  sitDurationHours: z.coerce.number().min(1).max(12).optional(),
  petIds: z.array(z.string().uuid()).min(1).max(5),
  foodDays: z.coerce.number().int().min(0).max(14).optional(),
  isSharedWalk: z.boolean().optional(),
  dropoff: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  recurrence: recurrenceSchema.optional(),
});
type BookingBody = z.infer<typeof bookingSchema>;

/** The Nth start datetime for a recurrence rule (occurrence 0 = the first start). */
function occurrenceStart(first: Date, rule: Recurrence, index: number): Date {
  const d = new Date(first);
  if (rule.frequency === "weekly") {
    d.setDate(d.getDate() + rule.interval * 7 * index);
  } else {
    d.setMonth(d.getMonth() + rule.interval * index);
  }
  return d;
}

/**
 * Insert one booking occurrence (row + walk/sit segments + pets) inside an open
 * transaction and return its id. `start` is this occurrence's start instant;
 * timing for the other segments is derived from it. Pass `series` to link the
 * row back to its recurring series.
 */
async function insertOccurrence(
  client: PoolClient,
  customerId: string,
  body: BookingBody,
  quote: Quote,
  start: Date,
  series?: { id: string; index: number }
): Promise<string> {
  const hasWalk = body.serviceType === "walk" || body.serviceType === "walk_sit";
  const hasSit = body.serviceType === "sit" || body.serviceType === "walk_sit";
  const walkEnd = hasWalk ? new Date(start.getTime() + (body.walkDurationMinutes ?? 60) * 60000) : null;
  const sitStart = hasSit ? (body.serviceType === "walk_sit" ? walkEnd! : start) : null;
  const sitEnd = hasSit ? new Date(sitStart!.getTime() + (body.sitDurationHours ?? 4) * 3600000) : null;
  const bookingEnd = hasSit ? sitEnd! : walkEnd!;

  // Walker's accept/decline deadline: the response window, but never past the
  // booking's own start time. The expiry sweeper acts on this.
  const respondBy = new Date(
    Math.min(Date.now() + RESPONSE_WINDOW_MINUTES * 60_000, start.getTime())
  );

  const b = await client.query<{ id: string }>(
    `INSERT INTO bookings
       (customer_id, walker_id, service_type, status, start_at, end_at, currency,
        quoted_total, quoted_at, quote_expires_at, pricing_version, price_breakdown,
        dropoff_required, is_shared_walk, special_instructions, series_id, series_index,
        respond_by)
     VALUES ($1,$2,$3,'requested',$4,$5,$6,$7, now(), now() + interval '24 hours', $8, $9, $10, $11, $12, $13, $14, $15)
     RETURNING id`,
    [
      customerId,
      body.walkerId,
      body.serviceType,
      start.toISOString(),
      bookingEnd.toISOString(),
      quote.currency,
      quote.total,
      quote.pricingVersion,
      JSON.stringify(quote),
      body.dropoff ?? false,
      body.isSharedWalk ?? false,
      body.notes ?? null,
      series?.id ?? null,
      series?.index ?? null,
      respondBy.toISOString(),
    ]
  );
  const bookingId = b.rows[0].id;

  let seq = 0;
  if (hasWalk) {
    await client.query(
      `INSERT INTO booking_segments (booking_id, segment_type, start_at, end_at, location_type, sequence)
       VALUES ($1,'walk',$2,$3,'customer_home',$4)`,
      [bookingId, start.toISOString(), walkEnd!.toISOString(), seq++]
    );
  }
  if (hasSit) {
    await client.query(
      `INSERT INTO booking_segments (booking_id, segment_type, start_at, end_at, location_type, sequence)
       VALUES ($1,'sit',$2,$3,'walker_home',$4)`,
      [bookingId, sitStart!.toISOString(), sitEnd!.toISOString(), seq++]
    );
  }
  for (const petId of body.petIds) {
    await client.query("INSERT INTO booking_pets (booking_id, pet_id) VALUES ($1,$2)", [bookingId, petId]);
  }
  return bookingId;
}

// Same-day bookings need enough lead time for the walker to accept + arrive.
const MIN_LEAD_MINUTES = 30;

// A walk can't be started too far ahead of its scheduled time (walkers shouldn't
// clock in early), nor after the start window has clearly lapsed (past that it's a
// no-show and the owner can cancel for a refund via the existing flow).
const START_EARLY_GRACE_MINUTES = 15;
const START_LATE_GRACE_MINUTES = 30;

/** Returns an error string if the requested start is in the past / too soon, else null. */
function startTimeError(date: string, startTime: string): string | null {
  const start = new Date(`${date}T${startTime}:00`);
  if (Number.isNaN(start.getTime())) return "Please choose a valid start time.";
  if (start.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000) {
    return `Start time must be at least ${MIN_LEAD_MINUTES} minutes from now.`;
  }
  return null;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

interface WalkerRow {
  id: string;
  verification_status: string;
  service_types: string[];
  subscription_tier: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Validate the request + build an authoritative quote. Returns an error string or the result. */
async function buildQuote(body: BookingBody, customerId: string) {
  const w = await query<WalkerRow>(
    `SELECT id, verification_status, service_types, subscription_tier, latitude, longitude
       FROM users WHERE id = $1 AND role = 'walker'`,
    [body.walkerId]
  );
  const walker = w.rows[0];
  if (!walker) return { ok: false as const, error: "Walker not found" };
  if (walker.verification_status !== "verified")
    return { ok: false as const, error: "This walker isn't available for booking yet." };

  const needed = body.serviceType === "walk_sit" ? ["walk", "sit"] : [body.serviceType];
  if (!needed.every((s) => walker.service_types.includes(s))) {
    return { ok: false as const, error: "This walker doesn't offer that service." };
  }

  const cust = await query<{ latitude: number | null; longitude: number | null }>(
    "SELECT latitude, longitude FROM users WHERE id = $1",
    [customerId]
  );
  const c = cust.rows[0];
  let distanceKm: number | undefined;
  if (c?.latitude != null && c?.longitude != null && walker.latitude != null && walker.longitude != null) {
    distanceKm = haversineKm(c.latitude, c.longitude, walker.latitude, walker.longitude);
  }

  const input: QuoteInput = {
    serviceType: body.serviceType,
    walkDurationMinutes: body.walkDurationMinutes,
    sitDurationHours: body.sitDurationHours,
    petCount: body.petIds.length,
    foodDays: body.foodDays,
    distanceKm,
    isSharedWalk: body.isSharedWalk,
    tier: walker.subscription_tier,
  };
  const quote = await computeQuote(input);
  if (!quote) return { ok: false as const, error: "Pricing isn't configured yet." };
  return { ok: true as const, quote };
}

// POST /api/bookings/quote — authoritative price, no persistence.
bookingsRouter.post("/quote", async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) return unprocessable(res, "Please complete the booking details.", parsed.error.flatten());
  const te = startTimeError(parsed.data.date, parsed.data.startTime);
  if (te) return unprocessable(res, te);
  const result = await buildQuote(parsed.data, req.user!.userId);
  if (!result.ok) return unprocessable(res, result.error);
  const { walkerPayout, ...customerQuote } = result.quote; // hide internal payout
  void walkerPayout;
  return ok(res, { quote: customerQuote });
});

// POST /api/bookings — create a requested booking with a locked quote.
bookingsRouter.post("/", async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) return unprocessable(res, "Please complete the booking details.", parsed.error.flatten());
  const body = parsed.data;
  const customerId = req.user!.userId;

  const te = startTimeError(body.date, body.startTime);
  if (te) return unprocessable(res, te);

  // Pets must belong to the customer.
  const petCheck = await query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM pets WHERE id = ANY($1::uuid[]) AND owner_id = $2",
    [body.petIds, customerId]
  );
  if (Number(petCheck.rows[0].n) !== body.petIds.length) {
    return unprocessable(res, "One or more selected pets aren't yours.");
  }

  const result = await buildQuote(body, customerId);
  if (!result.ok) return unprocessable(res, result.error);
  const quote = result.quote;

  // The customer's chosen start, in server-local time. Recurring occurrences
  // step forward from here; pricing is date-independent so one quote applies
  // to every occurrence.
  const firstStart = new Date(`${body.date}T${body.startTime}:00`);

  // Customer's first name, for the walker-facing "new request" notification.
  const customerFirst =
    (await query<{ first_name: string }>("SELECT first_name FROM users WHERE id = $1", [customerId]))
      .rows[0]?.first_name ?? "A customer";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (body.recurrence) {
      const rule = body.recurrence;
      const s = await client.query<{ id: string }>(
        `INSERT INTO booking_series (customer_id, walker_id, frequency, interval, occurrence_count)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [customerId, body.walkerId, rule.frequency, rule.interval, rule.count]
      );
      const seriesId = s.rows[0].id;

      let firstBookingId = "";
      for (let i = 0; i < rule.count; i++) {
        const id = await insertOccurrence(client, customerId, body, quote, occurrenceStart(firstStart, rule, i), {
          id: seriesId,
          index: i,
        });
        if (i === 0) firstBookingId = id;
      }
      await client.query("COMMIT");
      await notify({
        userId: body.walkerId,
        type: "booking_requested",
        title: `${rule.count} new booking requests`,
        body: `${customerFirst} scheduled a recurring series — review the first one.`,
        bookingId: firstBookingId,
        data: { seriesId, count: rule.count },
      });
      return ok(
        res,
        { booking: { id: firstBookingId, status: "requested" }, series: { id: seriesId, count: rule.count } },
        `${rule.count} bookings requested`,
        201
      );
    }

    const bookingId = await insertOccurrence(client, customerId, body, quote, firstStart);
    await client.query("COMMIT");
    await notify({
      userId: body.walkerId,
      type: "booking_requested",
      title: "New booking request",
      body: `${customerFirst} requested a booking — accept or decline.`,
      bookingId,
    });
    return ok(res, { booking: { id: bookingId, status: "requested" } }, "Booking requested", 201);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

// GET /api/bookings — caller's bookings (as customer or walker).
bookingsRouter.get("/", async (req, res) => {
  const uid = req.user!.userId;
  const result = await query(
    `SELECT b.id, b.service_type AS "serviceType", b.status, b.start_at AS "startAt", b.end_at AS "endAt",
            b.quoted_total AS "quotedTotal", b.currency, b.is_shared_walk AS "isSharedWalk",
            b.customer_id AS "customerId", b.walker_id AS "walkerId",
            b.series_id AS "seriesId", b.series_index AS "seriesIndex",
            cu.first_name AS "customerFirst", cu.last_name AS "customerLast",
            w.first_name AS "walkerFirst", w.last_name AS "walkerLast"
       FROM bookings b
       JOIN users cu ON cu.id = b.customer_id
       JOIN users w  ON w.id = b.walker_id
      WHERE b.customer_id = $1 OR b.walker_id = $1
      ORDER BY b.start_at DESC LIMIT 100`,
    [uid]
  );
  const bookings = result.rows.map((b: Record<string, unknown>) => {
    const asWalker = b.walkerId === uid;
    return {
      id: b.id,
      serviceType: b.serviceType,
      status: b.status,
      startAt: b.startAt,
      endAt: b.endAt,
      quotedTotal: b.quotedTotal,
      currency: b.currency,
      isSharedWalk: b.isSharedWalk,
      seriesId: b.seriesId ?? null,
      seriesIndex: b.seriesIndex ?? null,
      role: asWalker ? "walker" : "customer",
      counterpartName: asWalker
        ? `${b.customerFirst} ${String(b.customerLast)[0]}.`
        : `${b.walkerFirst} ${String(b.walkerLast)[0]}.`,
    };
  });
  return ok(res, { bookings });
});

// GET /api/bookings/:id — detail.
bookingsRouter.get("/:id", async (req, res) => {
  const uid = req.user!.userId;
  const r = await query(
    `SELECT b.*, cu.first_name AS "customerFirst", cu.last_name AS "customerLast",
            w.first_name AS "walkerFirst", w.last_name AS "walkerLast"
       FROM bookings b
       JOIN users cu ON cu.id = b.customer_id
       JOIN users w  ON w.id = b.walker_id
      WHERE b.id = $1`,
    [req.params.id]
  );
  const b = r.rows[0];
  if (!b) return notFoundError(res, "Booking not found");
  if (b.customer_id !== uid && b.walker_id !== uid && req.user!.role !== "admin") {
    return notFoundError(res, "Booking not found"); // privacy
  }
  const segs = await query(
    `SELECT segment_type AS "segmentType", start_at AS "startAt", end_at AS "endAt",
            location_type AS "locationType", status
       FROM booking_segments WHERE booking_id = $1 ORDER BY sequence`,
    [req.params.id]
  );
  return ok(res, {
    booking: {
      id: b.id,
      serviceType: b.service_type,
      status: b.status,
      startAt: b.start_at,
      endAt: b.end_at,
      actualStartAt: b.actual_start_at,
      actualEndAt: b.actual_end_at,
      endedEarly: b.ended_early,
      missedMidPhoto: b.missed_mid_photo,
      currency: b.currency,
      quotedTotal: b.quoted_total,
      priceBreakdown: b.price_breakdown,
      isSharedWalk: b.is_shared_walk,
      dropoffRequired: b.dropoff_required,
      specialInstructions: b.special_instructions,
      role: b.walker_id === uid ? "walker" : "customer",
      counterpartName:
        b.walker_id === uid
          ? `${b.customerFirst} ${String(b.customerLast)[0]}.`
          : `${b.walkerFirst} ${String(b.walkerLast)[0]}.`,
      segments: segs.rows,
    },
  });
});

/** Transition helper: load booking, authorize, enforce allowed source statuses. */
async function transition(
  id: string,
  uid: string,
  as: "walker" | "customer" | "any",
  from: string[],
  to: string
) {
  const r = await query<{
    status: string;
    customer_id: string;
    walker_id: string;
    customer_first: string;
    walker_first: string;
  }>(
    `SELECT b.status, b.customer_id, b.walker_id,
            cu.first_name AS customer_first, w.first_name AS walker_first
       FROM bookings b
       JOIN users cu ON cu.id = b.customer_id
       JOIN users w  ON w.id = b.walker_id
      WHERE b.id = $1`,
    [id]
  );
  const b = r.rows[0];
  if (!b) return { error: "notfound" as const };
  const isWalker = b.walker_id === uid;
  const isCustomer = b.customer_id === uid;
  if (as === "walker" && !isWalker) return { error: "forbidden" as const };
  if (as === "customer" && !isCustomer) return { error: "forbidden" as const };
  if (as === "any" && !isWalker && !isCustomer) return { error: "forbidden" as const };
  if (!from.includes(b.status)) return { error: "conflict" as const };
  await query("UPDATE bookings SET status = $1 WHERE id = $2", [to, id]);
  return {
    ok: true as const,
    customerId: b.customer_id,
    walkerId: b.walker_id,
    customerFirst: b.customer_first,
    walkerFirst: b.walker_first,
    actor: uid,
  };
}

function handleTransition(res: import("express").Response, r: { error?: string }) {
  if (r.error === "notfound") return notFoundError(res, "Booking not found");
  if (r.error === "forbidden") return forbidden(res);
  if (r.error === "conflict") return conflict(res, "This booking can't change state right now.");
  return null;
}

interface BookingTimingRow {
  status: string;
  customer_id: string;
  walker_id: string;
  start_at: string;
  end_at: string;
  actual_start_at: string | null;
  walker_first: string;
}

/** Load + authorize a walker transition without mutating. Mirrors transition()'s checks. */
async function authorizeWalkerTransition(id: string, uid: string, from: string[]) {
  const r = await query<BookingTimingRow>(
    `SELECT b.status, b.customer_id, b.walker_id, b.start_at, b.end_at, b.actual_start_at,
            w.first_name AS walker_first
       FROM bookings b
       JOIN users w ON w.id = b.walker_id
      WHERE b.id = $1`,
    [id]
  );
  const b = r.rows[0];
  if (!b) return { error: "notfound" as const };
  if (b.walker_id !== uid) return { error: "forbidden" as const };
  if (!from.includes(b.status)) return { error: "conflict" as const };
  return { ok: true as const, booking: b };
}

// Bookings ending before this fraction of the booked duration are flagged for review.
const EARLY_COMPLETION_THRESHOLD = 0.9;

// Walker accepts — must be a VERIFIED walker.
bookingsRouter.post("/:id/accept", requireVerifiedWalker, async (req, res) => {
  const r = await transition(req.params.id, req.user!.userId, "walker", ["requested"], "accepted");
  const err = handleTransition(res, r);
  if (err) return err;
  await notify({
    userId: r.customerId!,
    type: "booking_accepted",
    title: "Booking accepted 🎉",
    body: `${r.walkerFirst} accepted your request — you're all set.`,
    bookingId: req.params.id,
  });
  return ok(res, { status: "accepted" }, "Booking accepted");
});
// Why a walker declined — structured for analytics/triage. Kept internal; the
// owner only ever sees a neutral "not available" message. Codes mirror the
// bookings.decline_reason CHECK constraint (migration 0014).
const declineSchema = z.object({
  reasonCode: z.enum([
    "unavailable",
    "too_far",
    "dog_fit",
    "too_many_dogs",
    "special_needs",
    "uncomfortable",
    "other",
  ]),
  note: z.string().max(1000).optional(),
});

bookingsRouter.post("/:id/decline", async (req, res) => {
  const parsed = declineSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return unprocessable(res, "Please choose a reason for declining.", parsed.error.flatten());
  const r = await transition(req.params.id, req.user!.userId, "walker", ["requested"], "declined");
  const err = handleTransition(res, r);
  if (err) return err;
  await query(
    `UPDATE bookings SET decline_reason = $1, decline_note = $2, updated_at = now() WHERE id = $3`,
    [parsed.data.reasonCode, parsed.data.note?.trim() || null, req.params.id]
  );
  // A declined request is normally pre-payment, but release any hold defensively.
  await voidOrRefundForBooking(req.params.id, "booking_declined");
  await notify({
    userId: r.customerId!,
    type: "booking_declined",
    title: "Booking declined",
    body: `${r.walkerFirst} can't take this one. Try another time or another walker.`,
    bookingId: req.params.id,
  });
  return ok(res, { status: "declined" }, "Booking declined");
});
bookingsRouter.post("/:id/cancel", async (req, res) => {
  const r = await transition(req.params.id, req.user!.userId, "any", ["requested", "accepted"], "cancelled");
  const err = handleTransition(res, r);
  if (err) return err;
  // Release the customer's money: void the hold if not yet captured, or refund per
  // the cancellation tiers if it was. Safe when there's no payment (e.g. cancelled
  // while still 'requested', before any hold was placed).
  await voidOrRefundForBooking(req.params.id, "booking_cancelled");
  // Notify whichever party didn't initiate the cancellation, naming the canceller.
  const cancelledByCustomer = r.actor === r.customerId;
  const recipient = cancelledByCustomer ? r.walkerId! : r.customerId!;
  const cancellerName = cancelledByCustomer ? r.customerFirst : r.walkerFirst;
  await notify({
    userId: recipient,
    type: "booking_cancelled",
    title: "Booking cancelled",
    body: `${cancellerName} cancelled this booking.`,
    bookingId: req.params.id,
  });
  return ok(res, { status: "cancelled" }, "Booking cancelled");
});
// Starting a walk requires a photo of the pet — proof the walker is on-site.
bookingsRouter.post("/:id/start", requireVerifiedWalker, photoUpload.single("photo"), async (req, res) => {
  if (!req.file) return unprocessable(res, "Please capture a photo of the pet to start the walk.");
  const a = await authorizeWalkerTransition(req.params.id, req.user!.userId, ["accepted"]);
  const err = handleTransition(res, a);
  if (err) return err;
  // Escrow gate: the customer's funds must be held before a walk can start, so a
  // walker is never asked to work an unpaid booking. Skipped only when payments
  // aren't configured (dev / pre-launch), so the flow still works end to end.
  if (isPaymentsConfigured() && !(await isBookingPaid(req.params.id))) {
    return conflict(res, "Waiting on the customer's payment — the walk can start once it's held.");
  }
  // Start-window gate: not too early (walkers can clock in up to 15 min ahead), and
  // not after the window has clearly lapsed (30 min past = treat as a no-show).
  const scheduledMs = new Date(a.booking!.start_at).getTime();
  const nowMs = Date.now();
  if (nowMs < scheduledMs - START_EARLY_GRACE_MINUTES * 60_000) {
    return conflict(
      res,
      `It's too early to start this walk. You can check in from ${START_EARLY_GRACE_MINUTES} minutes before the scheduled time.`
    );
  }
  if (nowMs > scheduledMs + START_LATE_GRACE_MINUTES * 60_000) {
    return conflict(
      res,
      "The start window for this booking has passed. Ask the owner to cancel it for a refund so it can be rebooked."
    );
  }
  await storeCheckpoint(req.params.id, "start", privateRef("walk", req.file.filename));
  await query(
    "UPDATE bookings SET status = 'in_progress', actual_start_at = now() WHERE id = $1",
    [req.params.id]
  );
  await notify({
    userId: a.booking!.customer_id,
    type: "walk_started",
    title: "Your walk has started 🐾",
    body: `${a.booking!.walker_first} just checked in with a photo of your dog.`,
    bookingId: req.params.id,
  });
  return ok(res, { status: "in_progress" }, "Walk started");
});

// Optional halfway photo while the walk is in progress (prompted at the midpoint).
bookingsRouter.post("/:id/photo", requireVerifiedWalker, photoUpload.single("photo"), async (req, res) => {
  if (!req.file) return unprocessable(res, "Please capture a photo of the pet.");
  const a = await authorizeWalkerTransition(req.params.id, req.user!.userId, ["in_progress"]);
  const err = handleTransition(res, a);
  if (err) return err;
  await storeCheckpoint(req.params.id, "during", privateRef("walk", req.file.filename));
  return ok(res, { saved: true }, "Photo added");
});

// Completing a walk requires a final photo, and flags integrity signals.
bookingsRouter.post("/:id/complete", requireVerifiedWalker, photoUpload.single("photo"), async (req, res) => {
  if (!req.file) return unprocessable(res, "Please capture a final photo of the pet to finish.");
  const a = await authorizeWalkerTransition(req.params.id, req.user!.userId, ["in_progress"]);
  const err = handleTransition(res, a);
  if (err) return err;
  const b = a.booking!;

  await storeCheckpoint(req.params.id, "end", privateRef("walk", req.file.filename));

  // Flag completions that finish meaningfully short of the booked duration.
  const bookedMs = new Date(b.end_at).getTime() - new Date(b.start_at).getTime();
  const startedAt = b.actual_start_at ? new Date(b.actual_start_at).getTime() : Date.now();
  const elapsedMs = Date.now() - startedAt;
  const endedEarly = bookedMs > 0 && elapsedMs < bookedMs * EARLY_COMPLETION_THRESHOLD;

  // Flag if no halfway photo was ever captured.
  const mid = await query(
    "SELECT 1 FROM booking_checkins WHERE booking_id = $1 AND type = 'during' LIMIT 1",
    [req.params.id]
  );
  const missedMidPhoto = mid.rowCount === 0;

  await query(
    `UPDATE bookings
        SET status = 'completed', actual_end_at = now(),
            ended_early = $2, missed_mid_photo = $3
      WHERE id = $1`,
    [req.params.id, endedEarly, missedMidPhoto]
  );
  // Walk is done — capture the held funds. This is the only point money actually
  // moves from the customer. No-op if unpaid / already captured.
  const captured = await captureForBooking(req.params.id);

  await notify({
    userId: b.customer_id,
    type: "walk_completed",
    title: "Walk completed ✅",
    body: `${b.walker_first} finished the walk. Tap to see the photos and leave a review.`,
    bookingId: req.params.id,
  });
  if (captured) {
    await notify({
      userId: b.customer_id,
      type: "payment_received",
      title: "Payment complete",
      body: `Your payment for this booking was charged now that the walk is done.`,
      bookingId: req.params.id,
    });
  }
  return ok(res, { status: "completed", endedEarly, missedMidPhoto }, "Walk completed");
});

// Customer "Report an issue" on a walk. Reason drives triage; note is optional context.
const disputeSchema = z.object({
  reason: z.enum(["ended_early", "missing_photos", "no_show", "pet_welfare", "other"]),
  note: z.string().max(1000).optional(),
});

// POST /api/bookings/:id/dispute — customer flags a problem; pauses walker payout.
bookingsRouter.post("/:id/dispute", async (req, res) => {
  const parsed = disputeSchema.safeParse(req.body);
  if (!parsed.success) return unprocessable(res, "Please choose what went wrong.", parsed.error.flatten());
  const result = await openDispute(
    req.params.id,
    req.user!.userId,
    parsed.data.reason,
    parsed.data.note ?? null
  );
  if (!result.ok) {
    if (result.code === "notfound") return notFoundError(res, result.message);
    if (result.code === "forbidden") return forbidden(res, result.message);
    return conflict(res, result.message);
  }
  // Let the walker know their payout is paused pending review (neutral tone).
  await notify({
    userId: result.walkerId,
    type: "dispute_opened",
    title: "A booking is under review",
    body: "The customer reported an issue with a recent booking. Payout is paused while we look into it.",
    bookingId: req.params.id,
  });
  return ok(res, { dispute: result.dispute }, "Thanks — our team will review this.", 201);
});

// GET /api/bookings/:id/dispute — current dispute state for this booking (parties only).
bookingsRouter.get("/:id/dispute", async (req, res) => {
  const b = await loadBookingForViewer(req.params.id, req.user!.userId, req.user!.role);
  if (!b) return notFoundError(res, "Booking not found");
  const dispute = await getDisputeForBooking(req.params.id);
  return ok(res, { dispute });
});

// GET /api/bookings/:id/photos — checkpoint list (which photos exist + when). Parties only.
bookingsRouter.get("/:id/photos", async (req, res) => {
  const b = await loadBookingForViewer(req.params.id, req.user!.userId, req.user!.role);
  if (!b) return notFoundError(res, "Booking not found");
  const c = await query<{ type: keyof typeof DB_TO_CHECKPOINT; created_at: string }>(
    "SELECT type, created_at FROM booking_checkins WHERE booking_id = $1",
    [req.params.id]
  );
  const photos = c.rows.map((row) => ({
    checkpoint: DB_TO_CHECKPOINT[row.type],
    takenAt: row.created_at,
  }));
  return ok(res, { photos });
});

// GET /api/bookings/:id/photos/:checkpoint/file — streams the image. Parties only.
bookingsRouter.get("/:id/photos/:checkpoint/file", async (req, res) => {
  const dbType = CHECKPOINT_TO_DB[req.params.checkpoint as Checkpoint];
  if (!dbType) return notFoundError(res, "Unknown photo");
  const b = await loadBookingForViewer(req.params.id, req.user!.userId, req.user!.role);
  if (!b) return notFoundError(res, "Booking not found");
  const r = await query<{ ref: string | null }>(
    "SELECT photo_url AS ref FROM booking_checkins WHERE booking_id = $1 AND type = $2",
    [req.params.id, dbType]
  );
  const fp = resolvePrivateFile(r.rows[0]?.ref ?? null);
  if (!fp) return notFoundError(res, "File not found");
  return res.sendFile(fp);
});
