import type {
  AuthorizeParams,
  AuthorizeResult,
  PaymentProvider,
  PayoutParams,
  PayoutResult,
  ProviderEvent,
} from "./types.js";

/**
 * Manual reconciliation rail — Whish, OMT and BOB Finance.
 *
 * These Lebanese rails have no live merchant API wired yet, so no gateway call
 * is made. Instead the customer pays the platform out-of-band (into our Whish
 * number / OMT or BOB beneficiary) quoting the reference this adapter mints, and
 * an admin confirms receipt. The provider methods below therefore only mint /
 * echo references — the real state transitions (pending → held → captured →
 * refunded) are driven by the service layer and admin actions, not a webhook.
 *
 * When a live API lands, swap this class for a real adapter behind the SAME
 * PaymentProvider interface; callers and the service layer don't change.
 */

const RAILS = ["whish", "omt", "bob"] as const;
export type ManualRailName = (typeof RAILS)[number];

export function isManualRail(name: string): name is ManualRailName {
  return (RAILS as readonly string[]).includes(name);
}

/** Human-friendly reconciliation reference, e.g. "WHISH-8F3K2Q". */
function mintReference(rail: ManualRailName): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${rail.toUpperCase()}-${rand}`;
}

export class ManualRailProvider implements PaymentProvider {
  readonly name: ManualRailName;

  constructor(name: ManualRailName) {
    this.name = name;
  }

  /**
   * "Authorize" a manual rail = open a collection the customer pays out-of-band.
   * No money moves here; we mint the reference to reconcile against and mark the
   * payment as still requiring the customer's action (they go pay externally).
   */
  async authorize(params: AuthorizeParams): Promise<AuthorizeResult> {
    return {
      providerRef: mintReference(this.name),
      // No card entry — the customer pays in the rail's app / at a branch.
      status: "requires_action",
    };
  }

  /** Funds arrive out-of-band and are confirmed by an admin — nothing to capture. */
  async capture(_providerRef: string): Promise<void> {
    /* no-op: reconciled manually */
  }

  /** Nothing is held on the rail, so there's nothing to void. */
  async voidAuthorization(_providerRef: string): Promise<void> {
    /* no-op: reconciled manually */
  }

  /** Refunds are sent back over the same rail as a back-office transfer. */
  async refund(): Promise<void> {
    /* no-op: refunded out-of-band */
  }

  /** Walker payouts run as a back-office batch over the rail. */
  async payout(_params: PayoutParams): Promise<PayoutResult> {
    return { providerRef: mintReference(this.name), status: "pending" };
  }

  /** No inbound webhooks on these rails yet. */
  parseWebhook(): ProviderEvent {
    return { type: "unknown", providerRef: "", raw: null };
  }
}
