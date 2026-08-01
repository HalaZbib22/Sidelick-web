import type { PaymentProvider } from "./types.js";
import { StripeProvider } from "./stripe.js";
import { ManualRailProvider } from "./manual.js";

/**
 * Provider registry. Stripe is the card rail (test/reference + Gulf). The
 * Lebanese rails — Whish, OMT and BOB Finance — are manual-reconciliation
 * adapters (no live merchant API wired yet). Cash-on-service moves no money
 * through any adapter; the service layer handles it directly.
 *
 * Callers that already know a payment's rail (from the stored `provider`) should
 * resolve it with getProviderByName; getProvider stays the currency/region
 * default used when first opening a card payment.
 */

const stripe = new StripeProvider();

const byName: Record<string, PaymentProvider> = {
  stripe,
  whish: new ManualRailProvider("whish"),
  omt: new ManualRailProvider("omt"),
  bob: new ManualRailProvider("bob"),
};

/**
 * Default provider for a booking's currency/region (the card rail). Lebanon
 * bookings pick an explicit method instead and resolve via getProviderByName.
 */
export function getProvider(_currency?: string): PaymentProvider {
  return stripe;
}

/** Resolve the adapter that owns a payment row, by its stored provider name. */
export function getProviderByName(name: string): PaymentProvider {
  const p = byName[name];
  if (!p) throw new Error(`No payment provider registered for '${name}'`);
  return p;
}

/** True when the card rail has the secrets it needs to process a charge. */
export function isPaymentsConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Payment methods offered to a customer. The manual Lebanese rails and cash need
 * no gateway secrets, so they're always available; card only when Stripe is set.
 */
export function availableMethods(): Array<"card" | "whish" | "omt" | "bob" | "cash"> {
  const methods: Array<"card" | "whish" | "omt" | "bob" | "cash"> = [];
  if (isPaymentsConfigured()) methods.push("card");
  methods.push("whish", "omt", "bob", "cash");
  return methods;
}

/** Publishable key the frontend needs to mount Stripe Elements (safe to expose). */
export function getPublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? null;
}

export * from "./types.js";
