/**
 * Provider-agnostic payment interface (payments_spec §5).
 *
 * The rest of the app talks to a `PaymentProvider`, never to a specific gateway.
 * Stripe is the first concrete adapter (test/reference rail, and the intended
 * Gulf rail); Whish / OMT / Tap / PayTabs adapters slot in behind the same
 * interface for the Lebanon launch without touching booking logic.
 *
 * Money model (region-independent):
 *   amount        = customer_total (the locked quote, in booking.currency)
 *   commission    = platform take
 *   walkerPayout  = amount − commission
 *
 * Lifecycle: authorize (hold) → capture (on completion) → payout (batched).
 * Cancellations either void the hold (before capture) or refund (after).
 */

/** Minor-unit-safe money: we pass whole currency amounts and let adapters scale. */
export interface Money {
  amount: number; // e.g. 24.50
  currency: string; // 'USD' | 'AED' | 'SAR' | ...
}

export interface AuthorizeParams extends Money {
  bookingId: string;
  /** Stable id used to make authorize idempotent across retries. */
  idempotencyKey: string;
  /** Optional gateway customer handle for saved cards / off-session capture. */
  customerRef?: string;
  metadata?: Record<string, string>;
}

export interface AuthorizeResult {
  /** Gateway reference to persist in payments.provider_ref (e.g. Stripe pi_...). */
  providerRef: string;
  /** Client secret the frontend needs to confirm the payment, when applicable. */
  clientSecret?: string;
  /**
   * 'requires_action' — customer must still confirm (card entry / 3DS).
   * 'held' — funds authorized and held.
   * 'captured' — already captured (providers without a separate hold step).
   */
  status: "requires_action" | "held" | "captured";
}

export interface RefundParams {
  providerRef: string;
  /** Amount to refund; omit to refund the full captured amount. */
  amount?: number;
  currency: string;
  reason?: string;
}

export interface PayoutParams extends Money {
  walkerId: string;
  /** Gateway destination/sub-merchant handle for the walker, if the rail splits. */
  destinationRef?: string;
  idempotencyKey: string;
}

export interface PayoutResult {
  providerRef: string;
  status: "pending" | "paid";
}

/** Parsed, verified webhook event the router can act on. */
export interface ProviderEvent {
  type:
    | "authorized"
    | "captured"
    | "refunded"
    | "failed"
    | "canceled"
    | "unknown";
  providerRef: string; // the PaymentIntent id / gateway txn id
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string; // matches payments.provider enum

  /** Create/return an authorization hold for the customer_total. */
  authorize(params: AuthorizeParams): Promise<AuthorizeResult>;

  /** Capture a previously authorized hold (full amount). */
  capture(providerRef: string): Promise<void>;

  /** Void an uncaptured authorization (no money moved). */
  voidAuthorization(providerRef: string): Promise<void>;

  /** Refund a captured payment, fully or partially (cancellation tiers). */
  refund(params: RefundParams): Promise<void>;

  /** Release a walker's earnings (automated on split rails; stub elsewhere). */
  payout(params: PayoutParams): Promise<PayoutResult>;

  /** Verify + parse a raw webhook body into a ProviderEvent. */
  parseWebhook(rawBody: Buffer, signature: string | undefined): ProviderEvent;
}

/** Thrown by adapters that don't implement an operation on a given rail yet. */
export class ProviderNotImplemented extends Error {
  constructor(provider: string, op: string) {
    super(`${provider} adapter does not implement ${op} yet`);
    this.name = "ProviderNotImplemented";
  }
}
