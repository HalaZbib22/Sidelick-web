# Sidelick — Build Roadmap

Turns the v2 planning set into a development order. Goal of v1: **a real Beirut dog owner can find a vetted walker, book a same-day Walk & Sit, and pay — and the walker gets paid.** Everything is sequenced by dependency; build top-down within each phase.

**Doc map:** strategy → `market_positioning.md` · product/logic → `planning_v2.md` · data → `schema.sql` · API → `api_endpoints.md` · frontend → `frontend_guide_v2.md` · architecture → `architecture.md` · money → `payments_spec.md`.

---

## Two parallel tracks

A marketplace is supply + software. Run both at once:

- **Build track** — the phases below.
- **Supply track (non-engineering, start day 1)** — recruit and vet the first ~15–30 Beirut walkers/sitters with fairer economics than Rover. In an undersupplied market, supply quality *is* the product; no amount of code fixes an empty map.

---

## Client strategy (web-first, native later)

The backend is **API-first**, so a native app is *additive, not a rewrite*. Three "app-feeling" features sequence like this:

- **Chat** — full real-time on web (WebSocket). No native needed.
- **Notifications** — web/PWA push (Android/desktop) + **SMS/email fallback** (covers iPhone, where web push needs an installed PWA and is less reliable).
- **Live GPS tracking** — owners *viewing* a map = web is fine. The walker's phone *broadcasting* in the background is the one real web weakness. So: **pilot delivers trust via photo/GPS check-ins** (`booking_checkins`), and a **native walker app (React Native / Expo)** for reliable background GPS + push comes after the pilot (Phase 3), reusing the same API.

Net: launch as a **web app / installable PWA**; add the native walker app once Beirut proves the model.

---

## Phase 0 — Foundations

*Nothing user-facing works without these.*

1. Repo, Next.js + TypeScript app, environments, CI.
2. **Database from `schema.sql`** + migration tooling (each change is a migration, never an edit-in-place — matches the versioned pricing config).
3. Standard API response envelope + `apiFetch` wrapper (`frontend_guide_v2.md` §8).
4. `lib/paths.ts`, `lib/validation.ts`, design system (shadcn + Tailwind), Sonner toaster.
5. `AuthContext` shell (`architecture.md`).
6. **PWA setup** — manifest, service worker, installable; foundation for web push and "Add to Home Screen".

---

## Phase 1 — Core marketplace MVP (Beirut pilot)

*Built strictly in this order — each step depends on the one above.*

1. **Auth** — signup/signin (owner + walker branches), forgot/reset, Google OAuth, JWT session. → `users`.
2. **Profiles & pets** — owner profile; **pet creation incl. `friendly_with_pets`** (gates Walk Share); walker profile (`service_types`, capacity caps). → `pets`, `users`.
3. **Walker onboarding + verification** — ID/doc upload, `verification_status`; availability editor. → `availability`, uploads.
4. **Discovery** — map + card list, filters, server-side distance. → `GET /walkers`. *(Needs walkers to exist — supply track.)*
5. **Walker profile page** — conversion page + reviews placeholder.
6. **Pricing engine (server-side)** — the canonical formula incl. surge, commission, min-earnings, Walk Share (`planning_v2.md` §3). → `POST /bookings/quote`. **Authoritative; build before the booking UI.**
7. **Stepped booking flow** — service → date → walk → sit → details → live price → request; segment-based write. → `bookings`, `booking_segments`, `booking_pets`.
8. **Availability/capacity validation** — pack/boarding/exclusive checks (`planning_v2.md` §2); revalidate on submit + accept.
9. **Booking state machine** — accept/decline/cancel/start/complete + per-segment status + check-ins.
10. **Payments (Lebanon rails)** — collect via Whish/Tap/OMT, hold, manual reconcile, weekly payout run (`payments_spec.md`). → `payments`, `payouts`. **Resolve the licensing/entity question first.**
11. **Messaging** — threaded per booking (WebSocket).
12. **Transactional notifications** — booking requested/accepted/started/completed via PWA push + **SMS/email fallback**. Trust-critical, so it's in the MVP, not deferred.
13. **Reviews** — post-completion; feeds walker rating.
14. **Minimal admin** — verify walkers, manage pricing config, reconcile payments, refund.

**MVP = 1–14.** That's a closed loop: discover → book → pay → serve (with photo/GPS check-ins) → review → pay out.

---

## Phase 2 — Retention & ops

Points/streaks/rewards · richer notification preferences · earnings dashboard polish · basic analytics (bookings, no-show rate, supply density) to validate the pilot.

---

## Phase 3 — Gulf-ready activation

*Mostly already modeled — this turns it on.*

Multi-currency live (AED/SAR) · Arabic + RTL localization · **Gulf PSP adapter** (Tap Destinations / PayTabs — automated split, retire manual payouts) · **heat-aware scheduling** (default morning/evening walk windows, nudge to indoor daycare in extreme heat) · regional pricing config rows.

**Native walker app (React Native / Expo)** — the payoff of the API-first design. Adds **background GPS live tracking** and reliable native push, reusing every existing endpoint. Owners can stay on web/PWA (live-map viewing works there); the native app is what the *walker* runs during a walk. Trigger this once the pilot shows tracking is worth the investment.

---

## Phase 4 — Expansion features

Community module (feed/posts/comments — `planning_v2.md` §6) · multi-day & travel booking UI · recurring templates (Mon–Fri daycare) · sit-at-customer-home · pickup-at-start · specialty-care matching · **native owner app / full app parity** (extends the Phase 3 native walker app — same API).

---

## Critical path (the risky few)

These gate everything; de-risk them early:

1. **Supply density in Beirut** — no walkers, no product. (Supply track.)
2. **Payments licensing/entity** — could reshape whether you hold funds at all (`payments_spec.md` §7). Answer before Phase 1 step 10.
3. **Server-authoritative pricing + availability** — the correctness core; get the quote/lock/revalidate flow right (`planning_v2.md` §2–3).
4. **Trust** — vetting + GPS/photo check-ins; the whole value prop in an informal market.

---

## What to validate in the pilot

Before spending on Gulf expansion, prove in Beirut: can you keep the map full (supply retention), is the no-show rate materially below Rover/Wag, do owners rebook, and does Walk Share actually get adoption? These answers decide whether — and how — Phase 3 happens.
