# Sidelick — Booking Architecture v2 (Rework)

**Status:** Aligned in planning. Supersedes `planning_walk_sit_daycare.md`. Once approved, fold into `business_logic.md` and trim `frontend_guide.md` accordingly.

**Why this rework:** The previous plan modeled a combined Walk & Sit as a single composite `bookings` row (`walk_start_time`, `walk_end_time`, `start_time`, `end_time`, `drop_off_at_home`, two distance fields). That row means different things by `service_type` and forces a schema migration the moment we add multi-day, multiple walks per day, or recurring care. It also conflated two fundamentally different resources (walk time vs. boarding capacity) under one availability block, and left the price undefined between request and acceptance.

This v2 fixes the data model, availability, and pricing as one coherent system.

---

## 1. Data model: parent booking + segments

A **booking is the order**; the actual work is broken into **segments**. Every product becomes the same shape — only the segments differ.

### 1.1 `bookings` (the order)

| Field | Notes |
|---|---|
| `id`, `customer_id`, `walker_id` | |
| `service_type` | `'walk' \| 'sit' \| 'walk_sit'` — product label, **validated against the segments**, not the source of truth for timing. |
| `status` | `draft → requested → accepted → in_progress → completed`, plus `declined`, `cancelled`. |
| `start_at`, `end_at` | Overall span, derived from min/max of segments. Stored for fast range queries. |
| `quoted_total`, `quoted_at`, `pricing_version` | The **price lock** (see §3). |
| `price_breakdown` | JSONB snapshot of the full quote. |
| `dropoff_required`, `dropoff_distance_km` | End-of-day delivery to customer. |
| `pickup_required`, `pickup_distance_km` | Pickup at start. Modeled now, **off in v1** — no migration later. |
| `cancellation_policy`, `special_instructions` | |
| `created_at`, `updated_at` | |

Pets link via a `booking_pets` join table (supports per-pet data without array columns).

### 1.2 `booking_segments` (the units of work)

| Field | Notes |
|---|---|
| `id`, `booking_id` | |
| `segment_type` | `'walk' \| 'sit'`. |
| `start_at`, `end_at` | Each segment owns its own window. |
| `location_type` | `'customer_home' \| 'walker_home'`. |
| `day_index`, `sequence` | Ordering for multi-day and multiple walks per day. |
| `status` | `scheduled \| in_progress \| done \| skipped` — enables "cancel one day" of a multi-day stay. |
| `segment_price`, `segment_breakdown` | Per-segment cost (JSONB), so the receipt has line items. |
| `pack_id` | Nullable. Walk segments from **different bookings** that share one pooled pack walk reference the same `pack_id` (see §2). |
| `metadata` | JSONB (e.g. walk distance, check-in refs). |

### 1.3 Pet attributes that drive matching

Captured when the owner adds a pet (onboarding):

| Field | Purpose |
|---|---|
| `friendly_with_pets` | `friendly \| selective \| not_friendly`. **Gates pack walking** — only `friendly` dogs are eligible to be pooled with other owners' dogs; `not_friendly` is recommended 1-on-1 only. |
| `weight` / `size`, `age`, `notes` | Used for matching, pricing tiers, and walker suitability. |

### 1.4 Every product is just a segment composition

| Product | Segments |
|---|---|
| Walk | 1 walk |
| Sit | 1 sit |
| **Walk & Sit (same-day)** | 1 walk + 1 sit |
| Travel / multi-day | N sit segments + walk segments per day |
| 2 walks/day, recurring | more segments — **no schema change** |

The composite-row problem (`walk_start_time` etc.) disappears entirely.

---

## 2. Availability & capacity (the core logic fix)

Walks and sits consume **different resources**, and the rules differ by service *and* location. The old plan treated a Walk & Sit as one contiguous block consuming `max_pets`, which is wrong and causes both false "unavailable" results and dangerous double-bookings.

**Walks — pack-shareable, not exclusive.** A walker can take several dogs on one walk, including dogs from *different owners*, when they fit together. A walk segment is poolable into a shared pack (`pack_id`) when **all** of these hold:

- combined dogs ≤ `max_pack_size`,
- pickup locations within `pack_radius_km`,
- time windows overlap,
- **every dog in the pack is `friendly_with_pets = friendly`.** `selective`/`not_friendly` dogs fall back to 1-on-1 and are never auto-pooled.

So a "walk slot" is shared capacity under constraints (ride-pool-like), not a hard 1.

**Sits — capacity depends on location:**

- `walker_home` (**boarding, concurrent**): one sitter hosts several dogs across customers at once. Validated against a per-night pet counter (`max_boarding_pets`).
- `customer_home` (**exclusive**): the sitter is dedicated to that one household for the whole window — it blocks their calendar like a walk. Capacity = that customer's own dog count; no cross-customer concurrency.

```
walker capacity:
  max_pack_size       walks: max dogs per pooled pack (e.g. 4)
  pack_radius_km      walks: max pickup spread for pooling
  max_boarding_pets   sit @ walker_home: concurrent dogs across customers (e.g. 3)
                      sit @ customer_home = exclusive (occupies sitter for the window)

availability = weekly schedule
               MINUS walk packs that are full OR can't accept this dog (size/radius/time/temperament)
               MINUS nights where boarding pet-count is full
               MINUS windows blocked by an exclusive customer-home sit
```

A Walk & Sit validates **each segment against its own resource** — independently. Availability is computed **server-side** and **revalidated at acceptance**.

---

## 3. Pricing (commission model)

One canonical, ordered formula. Computed **server-side only** — the frontend price is an estimate, never authoritative.

```
Per segment:
  effective_rate = admin_base_rate(service_type) × tier_multiplier   (tier hidden from customer)
  segment_base   = effective_rate × duration

Subtotal (sum across segments):
  subtotal = Σ (segment_base + distance_fee + per_pet_fee + food_fee)
           per-pet: diminishing  (1st incl, 2nd full, 3rd 50%, 4th+ 30%)
           food:    min(daily_fee, daily_cap) × days
           shared walk: walk_base × (1 − pool_discount_pct), and distance_fee
                        shared across the pack (one route) — see §3.2

Surge:
  service_price = subtotal × surge_multiplier        (capped; shown as "Peak time fee")

Commission split:
  platform_commission = platform_pct × service_price
  walker_payout       = service_price − platform_commission

Minimum-earnings protection:
  if walker_payout < min_wage × hours:
      walker_payout       = min_wage × hours
      platform_commission = max(0, service_price − walker_payout)    ← platform absorbs

Customer pays:
  customer_total = service_price          ← commission is INTERNAL, not added on top
```

**Display rule:** In a commission model the customer total *is* the service price. The "Platform fee → adds to Total" line from the old doc is a *surcharge* model leaking in and would charge commission twice. Either hide the platform fee from the customer or show it as a portion *of* the total (labeled "included"), never added on top.

**Hidden from customer:** walker payout, tier multipliers, raw surge multiplier, availability math.

### 3.1 Price lock (request → accept)

Surge depends on live availability, but acceptance happens later. So:

1. **At request:** server computes the authoritative price and snapshots `price_breakdown` + `quoted_total` + `pricing_version` + `quoted_at`. Quote is locked.
2. Quote has a **validity window**.
3. **At accept:** revalidate availability. If still free and within the window → honor the locked quote. If expired or availability changed materially → re-quote and require customer re-confirmation.

Pricing-config changes apply only to future bookings (versioned for audit).

### 3.2 Shared (pooled) walks — "Walk Share"

Like Uber Share: a customer opts into a **shared walk** and gets a cheaper price for letting their (pet-friendly) dog be pooled with others.

- **Flat discount.** `pool_discount_pct` (one value, stored in `platform_pricing_config` so it's tunable) is applied to the walk base. Same % regardless of pack size.
- **Shared distance.** The walker drives one route, so the distance fee is shared across the pack rather than charged in full to each owner.
- **Upfront & guaranteed.** The discounted price is shown and locked at request, *whether or not a pack actually forms* (Uber Share behavior). If no pack forms, the customer keeps the lower price on a solo walk and the **platform absorbs the gap** as a growth cost (min-earnings protection still guarantees the walker's floor).
- **Eligibility.** Only `friendly_with_pets = friendly` dogs can opt in. `selective`/`not_friendly` see 1-on-1 pricing only.
- **Walker economics stay positive.** Even discounted, multiple fares beat one: at 20% off, 2 dogs ≈ 1.6× and 3 dogs ≈ 2.4× a solo walk for roughly the same effort.

---

## 4. Booking flow (stepped, mobile-first)

Replaces the full-page Google-Calendar interface, which is heavy and rough on mobile. Proven consumer pattern (Rover-style):

```
1. Service     Walk | Sit | Walk & Sit   (only show Walk & Sit if walker offers both)
2. Dates       single date (same-day v1); date range later
3. Walk        time + duration, location = customer home
4. Sit         "until when?" end time; drop-off OR I'll pick up
5. Details     pets, food handling, special instructions
6. Price       live estimate, line-item breakdown
7. Request     locked quote → walker accepts
```

Each step validates before advancing; the price estimate updates live but the server quote governs on submit.

---

## 5. v1 scope

Web-first launch (lower cost), **native app later** — so everything is mobile-first and the API is the single source of truth a future app reuses.

- **Product:** same-day **Walk & Sit** (1 walk + 1 sit segment, one date).
- **Location:** walk at customer's area; sit at walker's home.
- **Pack walking:** cross-owner pooling **is** in v1, gated by `friendly_with_pets`. `selective`/`not_friendly` dogs are 1-on-1 only.
- **End of day:** drop-off at home (delivery fee) **or** owner picks up. No pickup-at-start.
- **Map:** Uber-style nearby walkers/sitters with availability, distance, rating, service type.
- **Data model:** full segment model above — multi-day and recurring are modeled but **not exposed in UI**, so v2 needs no migration.
- **Pricing:** commission model, server-authoritative, locked at request.
- **Availability:** pack/boarding/exclusive checks per §2, independent per segment.
- **UX:** stepped flow.

### Deferred (model supports, UI later)
Multi-day / travel · multiple walks per day · recurring templates (Mon–Fri daycare) · sit at customer's home · pickup-at-start · **community module** (§6).

---

## 6. Community module (planned, post-launch)

A community of dog owners is part of the long-term vision but is **not** in the revenue-critical v1. Specced separately so it's planned rather than bolted on. Likely shape:

- `community_posts`, `community_comments`, `community_likes` — feed of posts (text + photos), scoped local/global.
- Optional `follows` between owners; optional local groups.
- Reuses the existing media-upload pipeline and auth.

Booking and the marketplace ship first; community layers on top once the core loop earns.

---

## 7. Launch defaults (proposed — adjust any)

All values live in admin config (`platform_pricing_config` or a `platform_config` table) so they're tunable without a code change.

| Parameter | Default | Rationale |
|---|---|---|
| `max_pack_size` | **4 dogs** | Platform cap; walker may set their own lower limit, never higher. Common insurance/jurisdiction norm. |
| `pack_radius_km` | **2 km** | Max spread between pickup points so one route stays efficient. |
| `pool_discount_pct` | **20%** | Off the walk base for shared walks. Keeps walker economics positive (2 dogs ≈ 1.6×). |
| Travel buffer | **15 min** | Fixed gap between consecutive walks/packs in v1; distance-derived later. |
| Quote validity window | **24 h** | Locked quote honored this long; walker must accept within it or it re-quotes. |
| `max_boarding_pets` | **3 dogs** | Platform cap for sit @ walker_home; walker sets their own ≤ cap during onboarding. |
| Surge: radius | **5 km** | Area scanned for available-walker supply. |
| Surge: trigger | **< 3 available walkers** in radius | Below this, surge engages. |
| Surge: cap | **1.5×** | Maximum multiplier, shown as "Peak time fee". |
| Cancellation | Free ≥ **24 h** before start · **50%** within 24 h · **no refund** once started | One policy per booking in v1; per-segment cancellation deferred with multi-day. |

*Resolved earlier:* pooled-walk pricing → flat, admin-configurable discount; platform absorbs unmatched shared walks (§3.2).
