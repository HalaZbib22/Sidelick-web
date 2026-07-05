import webpush from "web-push";
import { query } from "./db.js";

/**
 * Web Push (closed-app notifications).
 *
 * Socket.IO covers the case where the user has the tab open. Web Push covers
 * the rest: the browser is closed or backgrounded, the OS still wakes the
 * service worker and shows a notification. Each `notify()` call fans out to
 * every push subscription the recipient has registered.
 *
 * VAPID keys identify our server to the push services (FCM/Mozilla/etc). Generate
 * a pair once with `npx web-push generate-vapid-keys` and put them in the backend
 * env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Without them, push is simply a
 * no-op — the app still works, just no closed-app delivery.
 */

const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "mailto:support@sidelick.app";

export const pushEnabled = Boolean(publicKey && privateKey);

if (pushEnabled) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
} else {
  console.warn("Web Push disabled: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable closed-app notifications.");
}

/** The public key the browser needs to create a subscription. */
export function getVapidPublicKey(): string {
  return publicKey;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Upsert a subscription for a user (idempotent on endpoint). */
export async function saveSubscription(userId: string, sub: PushSubscriptionInput, userAgent?: string) {
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint)
       DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
                     auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent,
                     last_used_at = now()`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent ?? null]
  );
}

/** Remove a subscription by endpoint (called on client unsubscribe). */
export async function deleteSubscription(endpoint: string) {
  await query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
}

export interface PushPayload {
  title: string;
  body?: string;
  /** Click-through path inside the app, e.g. "/bookings/123". */
  url?: string;
  /** Collapses notifications that share a tag (latest replaces older). */
  tag?: string;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a push to all of a user's devices. Stale subscriptions (the push
 * service replies 404/410 Gone) are pruned. Never throws into the caller.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushEnabled) return;
  try {
    const r = await query<SubRow>(
      "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
      [userId]
    );
    if (r.rowCount === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      r.rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await query("DELETE FROM push_subscriptions WHERE endpoint = $1", [sub.endpoint]);
          } else {
            console.error("push send failed:", status ?? err);
          }
        }
      })
    );
  } catch (e) {
    console.error("pushToUser failed:", e);
  }
}
