# Sidelick — Frontend Guide v2 (Lean)

**Purpose:** Product-specific frontend reference. Screens, flows, and the design system — *not* general engineering philosophy.

**Stack:** Next.js (App Router) · TypeScript · shadcn/ui · Tailwind core utilities · Sonner (toasts).

**Architecture rules** (state management, data fetching, code organization) live in `architecture.md`. **Data model, pricing, availability, booking logic** live in `planning_v2.md` — this guide assumes them.

**North star:** mobile-first (web now, native app later), minimal and trust-focused, server-authoritative for anything that touches money or availability.

---

## 1. Screen map

```
/                       Landing
/signin /signup         Auth (+ /forgot-password, /reset-password)
/onboarding             Role-specific (owner vs walker)
/dashboard              Owner: map + discovery · Walker: bookings + earnings
/walkers/[id]           Walker profile (conversion page)
/walkers/[id]/book      Stepped booking flow
/bookings /bookings/[id]  Booking list + detail (state, messages, check-ins)
/messages               Threaded chat (per booking)
/pets                   Manage pets
/profile                Account
```

Community screens (feed, posts) are a **post-launch module** — not in v1 (see `planning_v2.md` §6).

---

## 2. Auth

Email/password + Google OAuth. Multi-step signup branches by role (owner vs walker). Forgot/reset via tokened email (dev returns the link in the response). Sign-out is client-side token clear (stateless JWT, 7-day expiry).

Every submit shows a Sonner toast on success/error and inline field errors. See `architecture.md` for the token/session handling and the standard API response shape (§6 here).

> **Security note for review:** JWT in `localStorage` is XSS-exposed. For a platform handling PII and payments, evaluate httpOnly cookies + short-lived access tokens before launch. Flagged, not yet decided.

---

## 3. Onboarding

**Owner:** add pet(s) — name, breed, age, size, and **`friendly_with_pets`** (`friendly | selective | not_friendly`). The temperament flag gates Walk Share eligibility downstream, so make it a clear, required choice with a one-line explanation ("friendly dogs can join cheaper group walks"). Optional profile photo.

**Walker:** personal info + ID upload (verification), then:

- **Service types:** Walk · Sit · Both (`users.service_types` JSONB).
- **Capacity:** `max_pack_size` (≤ platform cap 4) and `max_boarding_pets` (≤ cap 3) — only the relevant ones for their service types.
- **Availability:** weekly schedule → `availability` table.
- Bio (≤ 500 chars), profile photo, verification doc.

Pricing is **not** set by walkers — it's admin-controlled; walkers earn tier-based bonuses (Starter/Pro/Elite). Progress bar, inline validation, swipeable steps on mobile.

---

## 4. Discovery (owner dashboard)

Uber-style **map** of nearby walkers/sitters plus a scrollable card list.

- **Filters:** distance, rating, price, service type (Walk / Sit / Both), and **Walk Share available**.
- **Card:** photo, name, verification + tier badge, rating, distance, service types, price-from, availability snippet.
- Distance and availability computed **server-side**.
- Tapping a card → `/walkers/[id]`.

---

## 5. Walker profile (`/walkers/[id]`)

Conversion page. Shows: name + photo + verification + tier badge, bio, average rating + recent reviews, effective price per service (base × tier, tier reasoning hidden from the number), availability summary, distance, trust indicators. Primary CTA **Book Now** → `/walkers/[id]/book`.

---

## 6. Booking flow (`/walkers/[id]/book`) — stepped

Replaces the old full-page calendar. A short, mobile-first stepped flow:

```
1. Service     Walk | Sit | Walk & Sit   (Walk & Sit only if walker offers both)
2. Date        single date (v1)
3. Walk        time + duration · location = your home area
                 └ if dog is `friendly`: offer "Walk Share — save 20%" toggle
4. Sit         "until when?" end time · drop-off OR I'll pick up
5. Details     pets, food handling, special instructions
6. Price       live estimate, line-item breakdown
7. Request     locked quote → walker accepts
```

Rules:

- Each step validates before advancing; a sticky summary shows running price.
- The price shown is an **estimate**; the **server quote is authoritative** and is locked at request (`planning_v2.md` §3.1).
- Availability is computed server-side and **revalidated on submit** and again at walker acceptance.
- Price breakdown stored in `bookings.price_breakdown`; per-segment lines in `booking_segments`.

**Breakdown display (commission model):** show service, distance, extra pets, food, peak-time fee, total. Do **not** add a platform-fee line *on top* — commission is internal. Walk Share shows as a discount line.

```
Walk (1 hr)                      $13.20
Walk Share (−20%)               −$2.64
Distance (shared, 2 km)          $2.00
Sit (4 hrs)                      $40.00
Additional pet                   $5.00
Peak time fee (+15%)             $8.48
─────────────────────────────────────
Total                            $66.04
```

---

## 7. Other screens (brief)

- **Bookings:** list + detail with the state machine (`requested → accepted → in_progress → completed`, plus declined/cancelled), per-segment status, check-ins, and the thread.
- **Messaging:** threaded per booking; accessible once a request exists. Real-time later via WebSocket.
- **Reviews:** after completion; rating feeds walker ranking/visibility.
- **Points / streaks / rewards:** wallet view; walker streak tracker; redeemable rewards.

---

## 8. API response contract

Every endpoint returns the same envelope. Frontend `apiFetch` unwraps `data`; Sonner surfaces `message`.

```ts
// success
{ succeeded: true,  statusCode: number, data: T,    message: string | null, elapsedMilliseconds: number }
// error
{ succeeded: false, statusCode: number, data: null, message: string,        elapsedMilliseconds: number, errors?: unknown }
```

Error `message` must be user-friendly ("Email already in use", not a constraint dump). Detailed errors are logged server-side only.

**Uploads** (`/api/upload/image|video|multiple`) return the same envelope with `{ path, url, filename, size, mimetype, thumbnail }`. Validate type/size client-side before sending; disable submit until upload completes; allow retry.

---

## 9. Design & UX principles

- **Mobile-first**, responsive; native app reuses the same API.
- **shadcn/ui** for all components; respect the [Laws of UX](https://lawsofux.com/).
- **Trust-forward:** verification badges, ratings, and safety messaging prominent.
- **Loading:** skeletons (matching real layout) for content; spinners for inline actions; disable controls while pending; feedback for any async op > 200 ms.
- **Validation:** validate every form against the schema; reusable validators in `lib/validation.ts` for complex/shared fields, inline for trivial one-offs; frontend for UX, backend is the security boundary (rules must match).
- **Feedback:** Sonner toast on every submit result; inline errors per field.
- **Paths:** never hardcode routes/endpoints — import from `lib/paths.ts`.
- **SEO:** SSR, per-page metadata + Open Graph, JSON-LD for walker profiles/reviews, semantic HTML, alt text, sitemap + robots.

---

## What changed from the previous guide

Removed the ~1,000-line state-management essay (Redux decision trees, migration phases), the triplicate validation-pattern code, and the large SEO/loading code dumps — condensed to principles here and moved the architecture rationale to `architecture.md`. Replaced the full-page calendar with the stepped flow. Aligned pricing display with the commission model and added Walk Share.
