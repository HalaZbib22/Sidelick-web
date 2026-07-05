import express, { type Request, type Response } from "express";
import { getProvider } from "../lib/payments/index.js";
import { applyProviderEvent } from "../lib/payments/service.js";

/**
 * Stripe (and future rails') webhook receiver.
 *
 * Signature verification needs the EXACT raw bytes Stripe sent, so this handler
 * must run on express.raw() and be mounted BEFORE express.json() in index.ts.
 * It only mirrors the gateway's truth onto the payments row; the booking
 * lifecycle capture/void still happens off the API's own transitions.
 */
export const paymentsWebhookHandler = [
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const provider = getProvider();
    const signature = req.get("stripe-signature");
    let event;
    try {
      event = provider.parseWebhook(req.body as Buffer, signature);
    } catch (err) {
      // Bad signature / unparseable — reject so the gateway retries (or gives up).
      console.error("[webhook] signature verification failed:", (err as Error).message);
      return res.status(400).send("Webhook signature verification failed");
    }

    try {
      if (event.type !== "unknown") {
        await applyProviderEvent(event.type, event.providerRef);
      }
    } catch (err) {
      // Ack failures loudly but don't 500 the gateway into an endless retry storm
      // for a transient DB hiccup — log and return 200 so Stripe moves on, our
      // own lifecycle transitions remain the source of truth for capture/void.
      console.error("[webhook] failed to apply event:", event.type, (err as Error).message);
    }
    return res.status(200).json({ received: true });
  },
] as const;
