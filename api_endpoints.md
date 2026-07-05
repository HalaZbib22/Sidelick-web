# Sidelick — API Endpoint Map

REST endpoints mapped to `schema.sql` tables and the booking logic in `planning_v2.md`. Every endpoint returns the standard envelope (`frontend_guide_v2.md` §8). JSON unless noted.

**Auth/access legend:** 🌐 public · 👤 any signed-in user · 🐕 owner role · 🚶 walker role · 🔒 resource owner only · 🛡 admin.

**Conventions:** auth via `Authorization: Bearer <jwt>`. Money/availability is **server-authoritative** — clients never compute final price or availability. Mutations validate against schema CHECK constraints; errors return user-friendly `message`.

---

## Auth

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| POST | `/api/signup` | 🌐 | `users` | role `user`\|`walker`; returns `{token, user}`. Unique email/phone. |
| POST | `/api/signin` | 🌐 | `users` | email+password → JWT. |
| POST | `/api/oauth/google` | 🌐 | `users` | upsert by `oauth_provider`/`oauth_id`. |
| POST | `/api/forgot-password` | 🌐 | `users` | sets `password_reset_token`/`_expires`; always 200 (no enumeration). |
| POST | `/api/reset-password` | 🌐 | `users` | validates token not expired; bcrypt; clears token. |
| GET | `/api/me` | 👤 | `users` | current session user. |
| PATCH | `/api/me` | 🔒 | `users` | profile, `locale`, `preferred_currency`, photo, location, bio. |

Sign-out is client-side (clear token) — no endpoint.

---

## Pets

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| GET | `/api/pets` | 🐕🔒 | `pets` | caller's pets. |
| POST | `/api/pets` | 🐕 | `pets` | requires `friendly_with_pets` (gates Walk Share). |
| GET | `/api/pets/:id` | 🔒 | `pets` | |
| PATCH | `/api/pets/:id` | 🔒 | `pets` | |
| DELETE | `/api/pets/:id` | 🔒 | `pets` | blocked if referenced by an active booking (FK RESTRICT). |

---

## Discovery & walker profiles

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| GET | `/api/walkers` | 👤 | `users`, `reviews`, `availability` | Map/list. Filters: distance, rating, price, `service_types`, **walk-share available**. Distance + availability computed server-side. |
| GET | `/api/walkers/:id` | 👤 | `users`, `reviews` | Public profile: bio, tier, rating, effective price (tier hidden in the number), distance. |
| GET | `/api/walkers/:id/availability` | 👤 | `availability`, `booking_segments`, `walk_packs` | Free slots for a date — applies pack/boarding/exclusive rules (planning_v2 §2). |
| GET | `/api/walkers/:id/reviews` | 👤 | `reviews` | paginated. |

---

## Walker self-management

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| GET | `/api/me/availability` | 🚶🔒 | `availability` | weekly schedule. |
| PUT | `/api/me/availability` | 🚶🔒 | `availability` | replace schedule. |
| PATCH | `/api/me/walker-profile` | 🚶🔒 | `users` | `service_types`, `max_pack_size`, `max_boarding_pets`, bio, verification doc. |
| POST | `/api/me/verification` | 🚶🔒 | `users` | submit ID/doc → `verification_status='pending'`. |

---

## Bookings (the core loop)

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| POST | `/api/bookings/quote` | 👤 | (read-only) `platform_pricing_config`, `platform_config`, `booking_segments`, `walk_packs` | **Authoritative price**. Body = service, date, segments, pets, options, `is_shared_walk`. Returns `price_breakdown`, `quoted_total`, `currency`, `quote_expires_at`, `pricing_version`. Computes pack eligibility + surge. |
| POST | `/api/bookings` | 🐕 | `bookings`, `booking_segments`, `booking_pets` | Creates `status='requested'` with **locked quote** snapshot. Revalidates availability. |
| GET | `/api/bookings` | 👤 | `bookings` | caller's bookings (as owner or walker); filter by status. |
| GET | `/api/bookings/:id` | 🔒 | `bookings`, `booking_segments`, `booking_pets`, `messages`, `booking_checkins` | full detail. |
| POST | `/api/bookings/:id/accept` | 🚶🔒 | `bookings`, `walk_packs` | Revalidate availability + quote window; honor or re-quote (planning_v2 §3.1). → `accepted`. |
| POST | `/api/bookings/:id/decline` | 🚶🔒 | `bookings` | → `declined`. |
| POST | `/api/bookings/:id/cancel` | 🔒 | `bookings` | applies cancellation tiers from snapshot. → `cancelled`. |
| POST | `/api/bookings/:id/start` | 🚶🔒 | `bookings`, `booking_segments` | → `in_progress`. |
| POST | `/api/bookings/:id/complete` | 🚶🔒 | `bookings`, `booking_segments` | → `completed`; triggers points/streak. |
| PATCH | `/api/bookings/:id/segments/:sid` | 🚶🔒 | `booking_segments` | per-segment status (`in_progress`/`done`/`skipped`). |
| POST | `/api/bookings/:id/checkins` | 🚶🔒 | `booking_checkins` | photo/note (`start`\|`during`\|`end`); uses upload URL. |

> Walk packs are matched **server-side** during quote/accept (shared `pack_id` across bookings); no public pack CRUD in v1.

---

## Messaging & reviews

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| GET | `/api/bookings/:id/messages` | 🔒 | `messages` | thread; available once a request exists. |
| POST | `/api/bookings/:id/messages` | 🔒 | `messages` | WebSocket later. |
| POST | `/api/bookings/:id/messages/read` | 🔒 | `messages` | mark read. |
| POST | `/api/bookings/:id/reviews` | 🔒 | `reviews` | after `completed`; unique per (booking, reviewer). |

---

## Points, streaks, rewards

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| GET | `/api/me/points` | 👤 | `points` | ledger + balance (sum). |
| GET | `/api/me/streak` | 🚶 | `streaks` | walker streak. |
| GET | `/api/rewards` | 👤 | `rewards_catalog` | active rewards. |
| POST | `/api/rewards/:id/redeem` | 👤 | `rewards_catalog`, `points` | debits points (negative `delta`). |

---

## Uploads

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/upload/image` | 👤 | ≤10MB; jpeg/png/webp/gif. |
| POST | `/api/upload/video` | 👤 | ≤100MB; mp4/webm/quicktime. |
| POST | `/api/upload/multiple` | 👤 | ≤10 files. |

Return `{ path, url, filename, size, mimetype, thumbnail }` in the standard envelope.

---

## Payments & payouts (payments_spec.md)

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| POST | `/api/bookings/:id/pay` | 🐕🔒 | `payments`, `bookings` | Collect `customer_total` via the region's provider (Whish/Tap/OMT/...). Returns provider redirect/ref. |
| POST | `/api/payments/webhook/:provider` | 🌐* | `payments` | Provider callback → updates status (`held`/`captured`/`failed`). *Signature-verified, not session auth. |
| POST | `/api/payments/:id/reconcile` | 🛡 | `payments` | Manual confirm for OMT/Whish by reference number. |
| POST | `/api/bookings/:id/refund` | 🛡🔒 | `payments` | Cancellation-tier refund (`platform_config`). |
| GET | `/api/me/earnings` | 🚶🔒 | `payments`, `payouts` | Walker: captured earnings + payout history. |
| GET | `/api/me/payouts` | 🚶🔒 | `payouts` | walker's payouts. |
| POST | `/api/admin/payouts/run` | 🛡 | `payouts`, `payments` | Batch unpaid `walker_payout` into payouts (weekly). Gulf: PSP auto-splits instead. |

---

## Notifications & push

In-app notifications are persisted per user and pushed live over Socket.IO (room `user:<id>`). The same `notify()` path also fires a closed-app Web Push when the user has a subscription and VAPID keys are configured (graceful no-op otherwise).

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| GET | `/api/notifications` | 👤 | `notifications` | 50 most recent for the caller + `unreadCount`. |
| POST | `/api/notifications/read-all` | 👤 | `notifications` | mark every unread read → `unreadCount: 0`. |
| POST | `/api/notifications/:id/read` | 🔒 | `notifications` | mark one read (idempotent) → fresh `unreadCount`. |
| GET | `/api/push/vapid-public-key` | 👤 | — | VAPID public key for `pushManager.subscribe`; empty when unconfigured. |
| POST | `/api/push/subscribe` | 👤 | `push_subscriptions` | upsert a browser `PushSubscription` (by `endpoint`). |
| POST | `/api/push/unsubscribe` | 👤 | `push_subscriptions` | drop a subscription by `endpoint`. |

> Notification types include `booking_requested`, `booking_accepted`/`declined`/`cancelled`, `booking_expired`, `walk_started`/`completed`, `review_received`, `payment_received`, `promo`. Expired-request notifications route the customer to `/walkers` (with suggested alternatives) rather than the dead booking.

---

## Admin (separate portal/auth — planning_v2/frontend §4)

| Method | Path | Access | Tables | Notes |
|---|---|---|---|---|
| GET/POST | `/api/admin/pricing-config` | 🛡 | `platform_pricing_config` | **Append-only** new version per region/currency; never edit live rows. |
| GET/PATCH | `/api/admin/platform-config` | 🛡 | `platform_config` | singleton operational params. |
| POST | `/api/admin/walkers/:id/verify` | 🛡 | `users` | approve/reject → `verification_status`. |
| GET | `/api/admin/bookings` | 🛡 | `bookings` | oversight, incident resolution. |

---

## Deferred (post-v1)

pickup-at-start · **community module** (`/api/community/*`: posts, comments, likes, follows) · regional PSP integration for live payment capture/payout.

_Shipped since v1 draft: recurring booking series, Socket.IO realtime + in-app notifications, closed-app Web Push, request-expiry with alternative-walker suggestions._
