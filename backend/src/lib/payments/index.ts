import type { PaymentProvider } from "./types.js";
import { StripeProvider } from "./stripe.js";

/**
 * Provider registry. The active rail is config-driven per region (payments_spec
 * §5): today only Stripe is wired (test/reference + Gulf). Lebanon adapters
 * (Whish/OMT/Tap) register here later; callers never learn which rail runs.
 */

const stripe = new StripeProvider();

/**
 * Resolve the payment provider for a booking's currency/region. For now every
 * currency routes to Stripe; when Lebanon rails land, branch on region/currency
 * here (e.g. LB → Whish, GCC → Tap) with no change to callers.
 */
export function getProvider(_currency?: string): PaymentProvider {
  return stripe;
}

/** True when the active provider has the secrets it needs to process a charge. */
export function isPaymentsConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Publishable key the frontend needs to mount Stripe Elements (safe to expose). */
export function getPublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? null;
}

export * from "./types.js";
