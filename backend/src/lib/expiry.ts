import { query } from "./db.js";
import { notify } from "./realtime.js";

/**
 * Unanswered-request handling.
 *
 * A booking request the walker never accepts or declines shouldn't strand the
 * customer. Each request carries a `respond_by` deadline; this sweeper runs on
 * an interval, flips still-'requested' rows past their deadline to 'expired',
 * and sends the customer a "no response — here are other walkers" nudge with a
 * few nearby verified alternatives.
 *
 * Single-process in-memory scheduler (no external cron). If the API is ever run
 * multi-instance, move this to one worker or a locked job.
 */

// Walker has this long to respond, capped at the booking's start time (set at
// request time as least(now + window, start_at)). Tune as the marketplace grows.
export const RESPONSE_WINDOW_MINUTES = 180;

// How often the sweeper checks for due requests.
const SWEEP_INTERVAL_MS = 60_000;

// Max requests handled per sweep (keeps a backlog from spiking one tick).
const SWEEP_BATCH = 200;

interface ExpiredRow {
  id: string;
  customer_id: string;
  walker_id: string;
  series_id: string | null;
  service_type: string;
  walker_first: string;
}

interface AltWalker {
  id: string;
  first_name: string;
  last_name: string;
  latitude: number | null;
  longitude: number | null;
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

/** Up to `limit` verified walkers (excluding the one who didn't respond) that
 *  offer the needed service, nearest first when the customer has a location. */
async function suggestAlternatives(
  customerId: string,
  excludeWalkerId: string,
  serviceType: string,
  limit = 3
): Promise<{ id: string; name: string }[]> {
  const needed = serviceType === "walk_sit" ? ["walk", "sit"] : [serviceType];

  const cust = await query<{ latitude: number | null; longitude: number | null }>(
    "SELECT latitude, longitude FROM users WHERE id = $1",
    [customerId]
  );
  const c = cust.rows[0];

  const w = await query<AltWalker>(
    `SELECT id, first_name, last_name, latitude, longitude
       FROM users
      WHERE role = 'walker'
        AND verification_status = 'verified'
        AND id <> $1
        AND service_types @> $2::jsonb`,
    [excludeWalkerId, JSON.stringify(needed)]
  );

  const scored = w.rows.map((row) => {
    const dist =
      c?.latitude != null && c?.longitude != null && row.latitude != null && row.longitude != null
        ? haversineKm(c.latitude, c.longitude, row.latitude, row.longitude)
        : Number.POSITIVE_INFINITY;
    return { id: row.id, name: `${row.first_name} ${String(row.last_name)[0]}.`, dist };
  });
  scored.sort((a, b) => a.dist - b.dist);
  return scored.slice(0, limit).map(({ id, name }) => ({ id, name }));
}

/** One sweep: expire overdue requests and notify their customers. */
async function sweepOnce(): Promise<void> {
  const due = await query<ExpiredRow>(
    `SELECT b.id, b.customer_id, b.walker_id, b.series_id, b.service_type,
            w.first_name AS walker_first
       FROM bookings b
       JOIN users w ON w.id = b.walker_id
      WHERE b.status = 'requested'
        AND b.respond_by IS NOT NULL
        AND b.respond_by < now()
      ORDER BY b.respond_by ASC
      LIMIT $1`,
    [SWEEP_BATCH]
  );
  if (due.rowCount === 0) return;

  // Flip them all to expired in one statement.
  await query("UPDATE bookings SET status = 'expired' WHERE id = ANY($1::uuid[])", [
    due.rows.map((r) => r.id),
  ]);

  // One notification per group: a recurring series collapses into a single nudge
  // instead of one per occurrence.
  const seen = new Set<string>();
  for (const row of due.rows) {
    const groupKey = row.series_id ?? row.id;
    if (seen.has(groupKey)) continue;
    seen.add(groupKey);

    const alts = await suggestAlternatives(row.customer_id, row.walker_id, row.service_type);
    const top = alts[0];
    const body = top
      ? `${row.walker_first} didn't respond in time. ${top.name} is available nearby — tap to find another walker.`
      : `${row.walker_first} didn't respond in time. Tap to find another walker near you.`;

    await notify({
      userId: row.customer_id,
      type: "booking_expired",
      title: `No response from ${row.walker_first}`,
      body,
      bookingId: row.id,
      data: { alternatives: alts, seriesId: row.series_id ?? undefined },
    });
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Start the background sweeper. Safe to call once at boot. */
export function startExpirySweeper(): void {
  if (timer) return;
  timer = setInterval(() => {
    void sweepOnce().catch((e) => console.error("expiry sweep failed:", e));
  }, SWEEP_INTERVAL_MS);
  // Don't keep the process alive solely for the sweeper.
  if (typeof timer.unref === "function") timer.unref();
}
