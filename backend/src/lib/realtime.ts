import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyToken } from "./jwt.js";
import { query } from "./db.js";
import { pushToUser } from "./push.js";

/**
 * Real-time notification layer.
 *
 * One Socket.IO server attached to the HTTP server. Each authenticated socket
 * joins a private room `user:<id>`, so a notification is delivered only to its
 * recipient. Every notification is also persisted to the `notifications` table
 * so the bell shows history + unread count even when the user was offline.
 */

let io: Server | null = null;

const room = (userId: string) => `user:${userId}`;

/** Attach Socket.IO to the HTTP server with JWT auth on the handshake. */
export function initRealtime(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",") },
  });

  io.use((socket: Socket, next) => {
    // Token comes from the client handshake: io(url, { auth: { token } }).
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    void socket.join(room(userId));
  });

  return io;
}

export interface NotificationInput {
  userId: string;
  type:
    | "booking_requested"
    | "booking_accepted"
    | "booking_declined"
    | "booking_cancelled"
    | "booking_expired"
    | "walk_started"
    | "walk_completed"
    | "review_received"
    | "payment_received"
    | "dispute_opened"
    | "dispute_resolved"
    | "promo";
  title: string;
  body?: string;
  bookingId?: string;
  data?: Record<string, unknown>;
}

/** The three user-facing preference categories a notification type belongs to. */
export type NotificationCategory = "booking_updates" | "reviews" | "reminders";

/** Every notification type maps onto exactly one preference category. */
export const TYPE_CATEGORY: Record<NotificationInput["type"], NotificationCategory> = {
  booking_requested: "booking_updates",
  booking_accepted: "booking_updates",
  booking_declined: "booking_updates",
  booking_cancelled: "booking_updates",
  walk_started: "booking_updates",
  walk_completed: "booking_updates",
  payment_received: "booking_updates",
  dispute_opened: "booking_updates",
  dispute_resolved: "booking_updates",
  review_received: "reviews",
  booking_expired: "reminders",
  promo: "reminders",
};

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  bookingId: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

/**
 * Persist a notification and push it live to the recipient if connected.
 * Never throws into the caller's request path — a failed emit shouldn't break
 * the booking action that triggered it.
 */
export async function notify(input: NotificationInput): Promise<NotificationRow | null> {
  try {
    // Respect the recipient's per-category preferences: a muted category yields
    // no bell entry and no push. Absent key / missing user defaults to enabled.
    const pref = await query<{ enabled: boolean }>(
      `SELECT COALESCE((notification_prefs ->> $2)::boolean, true) AS enabled
         FROM users WHERE id = $1`,
      [input.userId, TYPE_CATEGORY[input.type]]
    );
    if (pref.rows[0]?.enabled === false) return null;

    const r = await query<NotificationRow>(
      `INSERT INTO notifications (user_id, type, title, body, booking_id, data)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, type, title, body, booking_id AS "bookingId",
                 data, read_at AS "readAt", created_at AS "createdAt"`,
      [input.userId, input.type, input.title, input.body ?? null, input.bookingId ?? null, JSON.stringify(input.data ?? {})]
    );
    const row = r.rows[0];
    io?.to(room(input.userId)).emit("notification", row);
    // Closed-app delivery: also fire a Web Push (no-op if VAPID isn't configured
    // or the user has no subscriptions). Fire-and-forget — never block notify().
    // Expired requests send the customer to discovery to rebook; everything
    // else deep-links to the booking.
    const url =
      row.type === "booking_expired"
        ? "/walkers"
        : row.bookingId
          ? `/bookings/${row.bookingId}`
          : "/bookings";
    void pushToUser(input.userId, {
      title: row.title,
      body: row.body ?? undefined,
      url,
      tag: row.bookingId ?? row.id,
    });
    return row;
  } catch (e) {
    console.error("notify failed:", e);
    return null;
  }
}
