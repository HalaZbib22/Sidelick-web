import { Router } from "express";
import { z } from "zod";
import { ok, unprocessable } from "../lib/response.js";
import { query } from "../lib/db.js";

// Mounted behind requireAuth.
export const notificationsRouter = Router();

// The categories a user can independently mute (see migration 0010).
const CATEGORIES = ["booking_updates", "reviews", "reminders"] as const;

/** Normalize stored JSONB prefs into a complete, defaulted-on object. */
function shapePrefs(stored: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(CATEGORIES.map((c) => [c, stored?.[c] !== false]));
}

// GET /api/notifications/preferences — caller's per-category toggles.
notificationsRouter.get("/preferences", async (req, res) => {
  const r = await query<{ prefs: Record<string, unknown> }>(
    "SELECT notification_prefs AS prefs FROM users WHERE id = $1",
    [req.user!.userId]
  );
  return ok(res, { preferences: shapePrefs(r.rows[0]?.prefs) });
});

const prefsSchema = z
  .object({
    booking_updates: z.boolean(),
    reviews: z.boolean(),
    reminders: z.boolean(),
  })
  .partial();

// PUT /api/notifications/preferences — merge partial toggle updates.
notificationsRouter.put("/preferences", async (req, res) => {
  const parsed = prefsSchema.safeParse(req.body);
  if (!parsed.success) return unprocessable(res, "Invalid preferences.", parsed.error.flatten());
  const r = await query<{ prefs: Record<string, unknown> }>(
    `UPDATE users
        SET notification_prefs = notification_prefs || $2::jsonb
      WHERE id = $1
      RETURNING notification_prefs AS prefs`,
    [req.user!.userId, JSON.stringify(parsed.data)]
  );
  return ok(res, { preferences: shapePrefs(r.rows[0]?.prefs) }, "Preferences saved");
});

// GET /api/notifications — recent notifications for the caller + unread count.
notificationsRouter.get("/", async (req, res) => {
  const uid = req.user!.userId;
  const list = await query(
    `SELECT id, type, title, body, booking_id AS "bookingId",
            data, read_at AS "readAt", created_at AS "createdAt"
       FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [uid]
  );
  const unread = await query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [uid]
  );
  return ok(res, { notifications: list.rows, unreadCount: Number(unread.rows[0].n) });
});

// POST /api/notifications/read-all — mark every unread notification read.
notificationsRouter.post("/read-all", async (req, res) => {
  const uid = req.user!.userId;
  await query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [uid]);
  return ok(res, { unreadCount: 0 });
});

// POST /api/notifications/:id/read — mark one notification read (idempotent).
notificationsRouter.post("/:id/read", async (req, res) => {
  const uid = req.user!.userId;
  await query(
    "UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
    [req.params.id, uid]
  );
  const unread = await query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [uid]
  );
  return ok(res, { unreadCount: Number(unread.rows[0].n) });
});
