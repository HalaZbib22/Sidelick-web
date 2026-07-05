# Sidelick — Payments Spec

How money moves: customer pays → platform holds → walker is paid out, minus commission. Tied to the booking lifecycle (`planning_v2.md` §3) and built provider-agnostic so Lebanon and the Gulf use different rails without an app rewrite.

> **Not financial/legal advice.** Holding customer funds before paying walkers can count as money transmission and may require licensing or a regulated PSP-of-record. Confirm structure with each PSP and a local advisor (Banque du Liban in Lebanon; relevant GCC regulators) before launch.

---

## 1. Regional reality (why this can't be one-size-fits-all)

**Lebanon (launch):**
- **Stripe does not support Lebanese businesses** — do not design around it.
- **Cash is 60–70%** of e-commerce; card penetration and trust are low.
- Economy is **dollarized** — price in **"fresh" USD**, not LBP, to avoid volatility.
- Most-trusted rails: **Whish Money** (1,000+ cash-in/out locations, fresh-dollar) and **OMT** (cash/transfer, reference-number confirmation); cards via **Tap Payments** or **Areeba**.
- Marketplace split-payment automation is immature locally → payouts are a **back-office process** at pilot scale.

**Gulf (expansion):**
- Mature marketplace PSPs with native escrow + split payouts: **Tap Payments** ("Destinations" — real-time split, fast onboarding, strong GCC/Kuwait) and **PayTabs** (deepest split/escrow/sub-merchant, best for Saudi). Others: HyperPay, MyFatoorah, Telr.

---

## 2. Core money model (region-independent)

Mirrors the commission pricing in `planning_v2.md` §3:

```
customer_total  = service_price (locked quote, in booking.currency)
platform takes  = platform_commission   (− min-earnings top-up if triggered)
walker payout   = service_price − platform_commission
```

Lifecycle:

1. **Request** — quote locked (`bookings.quoted_total`, `currency`, `pricing_version`). No charge yet.
2. **Accept** — **authorize / collect** `customer_total` into the platform-controlled balance (escrow). Card = auth+capture or hold; Whish/OMT = collect + reconcile by reference.
3. **In progress → completed** — funds confirmed captured.
4. **Payout** — release `walker_payout` to the walker (batched, e.g. weekly), commission retained.
5. **Cancellation** — refund per the snapshotted tiers (`platform_config`: free ≥24h, 50% within 24h, none once started).

Tips (if added) pass through 100% to the walker, no commission.

---

## 3. Lebanon v1 rails (pragmatic)

Because true automated split payouts don't exist locally, the **platform collects and pays out**:

- **Collect from owner**, in order of local trust:
  1. **Whish Money** — primary; fresh-dollar, ubiquitous cash-in network, brand owners trust.
  2. **Card** via Tap / Areeba — for card-comfortable users.
  3. **OMT** — reference-number transfer for higher-ticket (e.g. multi-day travel boarding).
  4. **Cash-on-service** *only* as fallback — and if used, commission is **invoiced to the walker** (or netted from their next payout), never left uncollected.
- **Hold** in the platform account (logical escrow — tracked in `payments`, not necessarily a regulated escrow account at pilot scale).
- **Pay out** walkers **weekly via Whish/OMT**, `walker_payout` summed across completed bookings. Semi-manual/back-office is acceptable at pilot volume and gives Hala direct control.
- **Price in USD**; display only.

This trades automation for trust and feasibility — correct for a Beirut pilot.

---

## 4. Gulf rails (expansion)

Switch the provider adapter to a real marketplace PSP — escrow and split payouts become **automated**:

- **Recommended: Tap Payments** for launch speed (Destinations handles real-time split to walker sub-accounts; strong GCC coverage).
- **PayTabs** if **Saudi-first** or split/escrow complexity grows (most configurable sub-merchant/escrow).
- Walkers onboard as **sub-merchants**; the PSP splits each charge into walker payout + platform commission automatically. No back-office payout runs.

---

## 5. Architecture: provider abstraction

One internal interface, swappable adapters — so the rest of the app never knows the rail.

```
PaymentProvider (interface)
  collect(booking)            → authorize/capture customer_total
  refund(payment, amount)     → cancellation tiers
  payout(walker, amount)      → release earnings
  reconcile(reference)        → Whish/OMT manual confirmation

adapters:  WhishAdapter · OmtAdapter · TapAdapter · AreebaAdapter · PayTabsAdapter · CashAdapter
```

`platform_pricing_config.region`/`currency` already pick the market; the active provider is config-driven per region. Webhooks (or manual reconcile for OMT/Whish) update payment status.

---

## 6. Data (see schema.sql additions)

- `payments` — one per booking: provider, method, `currency`, `amount`, `platform_commission`, `walker_payout`, status (`pending → held → captured → refunded → failed`), provider refs.
- `payouts` — batched release to a walker: amount, currency, method, status, period; links the payments it covers.
- Reuse `bookings.price_breakdown` for the quote; `payments` records the actual movement. Points/wallet stay separate (`points`).

---

## 7. Open items

1. **Entity & licensing** — where is the platform incorporated, and does collecting funds require a PSP-of-record or money-transmission license? (Biggest unknown.)
2. **Charge timing** — authorize at accept and capture at completion, or capture at accept? (Auth-at-accept is friendlier but Whish/OMT can't "authorize".)
3. **Cash-on-service** — offer at all in v1, given commission-collection friction?
4. **Payout cadence** — weekly vs on-demand; minimum payout threshold.
5. **FX** — if any LBP is ever accepted, what rate source and who bears spread? (Recommend USD-only to avoid this.)
