import Stripe from "stripe";
import type {
  AuthorizeParams,
  AuthorizeResult,
  PaymentProvider,
  PayoutParams,
  PayoutResult,
  ProviderEvent,
  RefundParams,
} from "./types.js";
import { ProviderNotImplemented } from "./types.js";

/**
 * Stripe adapter — manual-capture PaymentIntents.
 *
 * authorize() creates a PaymentIntent with capture_method:'manual', so confirming
 * it on the client places an authorization HOLD rather than charging immediately.
 * We capture on walk completion and void/refund on cancellation. This maps Stripe
 * onto the spec's "authorize at accept, capture at completion" model.
 *
 * The client is created lazily from STRIPE_SECRET_KEY; nothing here runs (or
 * throws) unless a payment is actually attempted, so the app boots fine without
 * Stripe configured.
 */

/** Stripe expects amounts in the smallest currency unit (cents for USD/AED/SAR). */
function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private _client: Stripe | null = null;
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  private client(): Stripe {
    if (this._client) return this._client;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    this._client = new Stripe(key);
    return this._client;
  }

  async authorize(params: AuthorizeParams): Promise<AuthorizeResult> {
    const pi = await this.client().paymentIntents.create(
      {
        amount: toMinorUnits(params.amount),
        currency: params.currency.toLowerCase(),
        capture_method: "manual", // authorize now, capture on completion
        automatic_payment_methods: { enabled: true },
        metadata: { bookingId: params.bookingId, ...(params.metadata ?? {}) },
        ...(params.customerRef ? { customer: params.customerRef } : {}),
      },
      { idempotencyKey: params.idempotencyKey }
    );
    return {
      providerRef: pi.id,
      clientSecret: pi.client_secret ?? undefined,
      // A freshly created PI still needs the customer to confirm a card.
      status: pi.status === "requires_capture" ? "held" : "requires_action",
    };
  }

  async capture(providerRef: string): Promise<void> {
    await this.client().paymentIntents.capture(providerRef);
  }

  async voidAuthorization(providerRef: string): Promise<void> {
    await this.client().paymentIntents.cancel(providerRef);
  }

  async refund(params: RefundParams): Promise<void> {
    await this.client().refunds.create({
      payment_intent: params.providerRef,
      ...(params.amount != null ? { amount: toMinorUnits(params.amount) } : {}),
      ...(params.reason ? { metadata: { reason: params.reason } } : {}),
    });
  }

  async payout(params: PayoutParams): Promise<PayoutResult> {
    // Automated split payout needs Stripe Connect + a walker connected account.
    // Until walkers onboard as connected accounts, payouts stay a back-office run
    // (Lebanon uses Whish/OMT). Surface this explicitly rather than silently no-op.
    if (!params.destinationRef) {
      throw new ProviderNotImplemented("stripe", "payout (no connected account)");
    }
    const transfer = await this.client().transfers.create({
      amount: toMinorUnits(params.amount),
      currency: params.currency.toLowerCase(),
      destination: params.destinationRef,
      metadata: { walkerId: params.walkerId },
    });
    return { providerRef: transfer.id, status: "paid" };
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): ProviderEvent {
    if (!this.webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    if (!signature) throw new Error("Missing Stripe-Signature header");
    const event = this.client().webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret
    );

    const obj = event.data.object as { id?: string; payment_intent?: string | { id: string } };
    const objId = obj.id ?? "";
    switch (event.type) {
      case "payment_intent.amount_capturable_updated":
        return { type: "authorized", providerRef: objId, raw: event };
      case "payment_intent.succeeded":
        return { type: "captured", providerRef: objId, raw: event };
      case "payment_intent.payment_failed":
        return { type: "failed", providerRef: objId, raw: event };
      case "payment_intent.canceled":
        return { type: "canceled", providerRef: objId, raw: event };
      case "charge.refunded": {
        const pi =
          typeof obj.payment_intent === "string"
            ? obj.payment_intent
            : typeof obj.payment_intent === "object" && obj.payment_intent
            ? obj.payment_intent.id
            : objId;
        return { type: "refunded", providerRef: pi, raw: event };
      }
      default:
        return { type: "unknown", providerRef: objId, raw: event };
    }
  }
}
