import { Router } from "express";
import { z } from "zod";
import { ok, unprocessable } from "../lib/response.js";
import { getVapidPublicKey, saveSubscription, deleteSubscription } from "../lib/push.js";

// Mounted behind requireAuth.
export const pushRouter = Router();

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// GET /api/push/vapid-public-key — the key the browser needs to subscribe.
pushRouter.get("/vapid-public-key", (_req, res) => {
  return ok(res, { publicKey: getVapidPublicKey() });
});

// POST /api/push/subscribe — register this browser for closed-app push.
pushRouter.post("/subscribe", async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) return unprocessable(res, "Invalid push subscription.", parsed.error.flatten());
  await saveSubscription(req.user!.userId, parsed.data, req.get("user-agent") ?? undefined);
  return ok(res, { subscribed: true }, "Notifications enabled");
});

// POST /api/push/unsubscribe — drop this browser's subscription.
pushRouter.post("/unsubscribe", async (req, res) => {
  const endpoint = z.string().url().safeParse(req.body?.endpoint);
  if (!endpoint.success) return unprocessable(res, "Invalid push endpoint.");
  await deleteSubscription(endpoint.data);
  return ok(res, { subscribed: false }, "Notifications disabled");
});
