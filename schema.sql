-- Sidelick — PostgreSQL schema
-- Source of truth: planning_v2.md (data model §1, pricing §3, availability §2, defaults §7)
-- Conventions: UUID PKs, text + CHECK for enums (easy to extend), JSONB for snapshots,
--   timestamptz everywhere, updated_at maintained by trigger (see bottom).
-- Community module (planning_v2 §6) is intentionally NOT included — post-launch.

-- gen_random_uuid() is built into PostgreSQL 13+ core — no extension required.

-- ============================================================
-- USERS  (owners, walkers, admins)
-- ============================================================
CREATE TABLE users (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role                   TEXT NOT NULL CHECK (role IN ('user', 'walker', 'admin')),

    first_name             TEXT NOT NULL,
    last_name              TEXT NOT NULL,
    email                  TEXT NOT NULL UNIQUE,
    phone                  TEXT,
    password_hash          TEXT,                       -- null for OAuth-only accounts
    date_of_birth          DATE,

    oauth_provider         TEXT,                       -- e.g. 'google'
    oauth_id               TEXT,

    profile_photo_url      TEXT,
    bio                    TEXT CHECK (char_length(bio) <= 500),

    -- Location (for the map / distance). PostGIS optional later; numeric is enough for v1.
    home_address           TEXT,
    latitude               NUMERIC(9, 6),
    longitude              NUMERIC(9, 6),

    -- Gulf-ready: localization & currency (see market_positioning.md)
    locale                 TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ar')),
    preferred_currency     TEXT NOT NULL DEFAULT 'USD'
                               CHECK (preferred_currency IN ('USD', 'LBP', 'AED', 'SAR')),

    -- Walker-only fields (null for owners)
    service_types          JSONB DEFAULT '[]'::jsonb,  -- e.g. ["walk"], ["sit"], ["walk","sit"]
    subscription_tier      TEXT CHECK (subscription_tier IN ('starter', 'pro', 'elite')),
    verification_doc_url    TEXT,
    verification_doc_type   TEXT CHECK (verification_doc_type IN ('national_id', 'drivers_license', 'passport')),
    verification_selfie_url TEXT,                              -- live selfie for face match
    verification_provider   TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | future IDV (uqudo, sumsub, ...)
    verification_result     JSONB,                            -- provider response when automated
    verification_submitted_at TIMESTAMPTZ,
    verification_status    TEXT DEFAULT 'unverified'
                               CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    max_pack_size          INT CHECK (max_pack_size BETWEEN 1 AND 4),    -- walks; ≤ platform cap
    max_boarding_pets      INT CHECK (max_boarding_pets BETWEEN 1 AND 3), -- sit @ walker_home; ≤ platform cap

    password_reset_token    TEXT,
    password_reset_expires  TIMESTAMPTZ,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT oauth_pair CHECK ((oauth_provider IS NULL) = (oauth_id IS NULL))
);
CREATE INDEX idx_users_role     ON users (role);
CREATE INDEX idx_users_location ON users (latitude, longitude);

-- ============================================================
-- PETS
-- ============================================================
CREATE TABLE pets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    name                TEXT NOT NULL,
    breed               TEXT,
    age_years           INT CHECK (age_years BETWEEN 0 AND 30),
    size                TEXT CHECK (size IN ('small', 'medium', 'large')),
    weight_kg           NUMERIC(5, 2),

    -- Gates Walk Share eligibility (planning_v2 §1.3, §2)
    friendly_with_pets  TEXT NOT NULL DEFAULT 'selective'
                            CHECK (friendly_with_pets IN ('friendly', 'selective', 'not_friendly')),

    notes               TEXT,
    photo_url           TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pets_owner ON pets (owner_id);

-- ============================================================
-- AVAILABILITY  (walker weekly recurring schedule)
-- ============================================================
CREATE TABLE availability (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    walker_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    weekday     INT  NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = Sunday
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT availability_time_order CHECK (end_time > start_time)
);
CREATE INDEX idx_availability_walker ON availability (walker_id, weekday);

-- ============================================================
-- WALK PACKS  (groups pooled "Walk Share" segments — planning_v2 §2, §3.2)
-- ============================================================
CREATE TABLE walk_packs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    walker_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    scheduled_start  TIMESTAMPTZ NOT NULL,
    scheduled_end    TIMESTAMPTZ NOT NULL,
    max_size         INT NOT NULL DEFAULT 4,
    status           TEXT NOT NULL DEFAULT 'forming'
                         CHECK (status IN ('forming', 'locked', 'in_progress', 'done', 'cancelled')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT walk_pack_time_order CHECK (scheduled_end > scheduled_start)
);
CREATE INDEX idx_walk_packs_walker ON walk_packs (walker_id, scheduled_start);

-- ============================================================
-- BOOKINGS  (the order — planning_v2 §1.1)
-- ============================================================
-- ============================================================
-- BOOKING SERIES  (recurrence rule for repeating walks/sits)
-- Each occurrence is a normal bookings row linked via series_id.
-- ============================================================
CREATE TABLE booking_series (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    walker_id        UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    frequency        TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
    interval         INT  NOT NULL DEFAULT 1 CHECK (interval BETWEEN 1 AND 4),
    occurrence_count INT  NOT NULL CHECK (occurrence_count BETWEEN 2 AND 26),

    status           TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'cancelled')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT series_distinct_parties CHECK (customer_id <> walker_id)
);
CREATE INDEX idx_series_customer ON booking_series (customer_id);
CREATE INDEX idx_series_walker   ON booking_series (walker_id);

CREATE TABLE bookings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    walker_id           UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    -- Recurrence: NULL for one-off bookings.
    series_id           UUID REFERENCES booking_series (id) ON DELETE SET NULL,
    series_index        INT,

    service_type        TEXT NOT NULL CHECK (service_type IN ('walk', 'sit', 'walk_sit')),
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'requested', 'accepted',
                                              'in_progress', 'completed', 'declined',
                                              'cancelled', 'expired')),

    -- Walker's accept/decline deadline. Set at request time to
    -- least(created_at + response window, start_at); a sweeper flips
    -- still-'requested' rows past this to 'expired'.
    respond_by          TIMESTAMPTZ,

    -- Why the walker declined (internal only — owner sees a neutral message).
    -- Structured code drives analytics/triage; note is the walker's own words.
    decline_reason      TEXT CHECK (decline_reason IN (
                            'unavailable', 'too_far', 'dog_fit', 'too_many_dogs',
                            'special_needs', 'uncomfortable', 'other')),
    decline_note        TEXT,

    -- Overall span (derived from segments; stored for range queries)
    start_at            TIMESTAMPTZ,
    end_at              TIMESTAMPTZ,

    -- Actual execution tracking (anti-fraud): set when the walker starts/finishes.
    actual_start_at     TIMESTAMPTZ,
    actual_end_at       TIMESTAMPTZ,
    ended_early         BOOLEAN NOT NULL DEFAULT false,  -- finished meaningfully short of booked duration
    missed_mid_photo    BOOLEAN NOT NULL DEFAULT false,  -- no halfway photo captured during the walk

    -- Price lock (planning_v2 §3.1)
    currency            TEXT NOT NULL DEFAULT 'USD'
                            CHECK (currency IN ('USD', 'LBP', 'AED', 'SAR')),
    quoted_total        NUMERIC(10, 2),
    quoted_at           TIMESTAMPTZ,
    quote_expires_at    TIMESTAMPTZ,
    pricing_version     INT,                       -- FK-ish to platform_pricing_config.version
    price_breakdown     JSONB,                     -- full quote snapshot

    -- Logistics
    dropoff_required    BOOLEAN NOT NULL DEFAULT false,
    dropoff_distance_km NUMERIC(6, 2),
    pickup_required     BOOLEAN NOT NULL DEFAULT false,  -- off in v1
    pickup_distance_km  NUMERIC(6, 2),

    is_shared_walk      BOOLEAN NOT NULL DEFAULT false,  -- Walk Share opt-in
    cancellation_policy JSONB,                           -- snapshot of tiers at booking time
    special_instructions TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT bookings_span_order CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at),
    CONSTRAINT bookings_distinct_parties CHECK (customer_id <> walker_id)
);
CREATE INDEX idx_bookings_walker   ON bookings (walker_id, start_at);
CREATE INDEX idx_bookings_customer ON bookings (customer_id, start_at);
CREATE INDEX idx_bookings_status   ON bookings (status);
CREATE INDEX idx_bookings_series   ON bookings (series_id, series_index);
CREATE INDEX idx_bookings_respond_by ON bookings (respond_by) WHERE status = 'requested';

-- ============================================================
-- BOOKING SEGMENTS  (units of work — planning_v2 §1.2)
-- ============================================================
CREATE TABLE booking_segments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id        UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,

    segment_type      TEXT NOT NULL CHECK (segment_type IN ('walk', 'sit')),
    start_at          TIMESTAMPTZ NOT NULL,
    end_at            TIMESTAMPTZ NOT NULL,
    location_type     TEXT NOT NULL CHECK (location_type IN ('customer_home', 'walker_home')),

    day_index         INT NOT NULL DEFAULT 0,   -- multi-day ordering
    sequence          INT NOT NULL DEFAULT 0,   -- ordering within a day (e.g. 2 walks/day)

    status            TEXT NOT NULL DEFAULT 'scheduled'
                          CHECK (status IN ('scheduled', 'in_progress', 'done', 'skipped')),

    segment_price     NUMERIC(10, 2),
    segment_breakdown JSONB,

    -- Pooled walk grouping: walk segments across DIFFERENT bookings share a pack
    pack_id           UUID REFERENCES walk_packs (id) ON DELETE SET NULL,

    metadata          JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT segment_time_order CHECK (end_at > start_at),
    -- only walk segments may belong to a pack
    CONSTRAINT segment_pack_walk_only CHECK (pack_id IS NULL OR segment_type = 'walk')
);
CREATE INDEX idx_segments_booking ON booking_segments (booking_id);
CREATE INDEX idx_segments_pack    ON booking_segments (pack_id);
CREATE INDEX idx_segments_window  ON booking_segments (segment_type, start_at, end_at);

-- ============================================================
-- BOOKING ↔ PETS  (join)
-- ============================================================
CREATE TABLE booking_pets (
    booking_id  UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    pet_id      UUID NOT NULL REFERENCES pets (id) ON DELETE RESTRICT,
    PRIMARY KEY (booking_id, pet_id)
);

-- ============================================================
-- CHECK-INS  (photos / status updates during a booking)
-- ============================================================
CREATE TABLE booking_checkins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    segment_id  UUID REFERENCES booking_segments (id) ON DELETE SET NULL,
    type        TEXT NOT NULL CHECK (type IN ('start', 'during', 'end')),
    note        TEXT,
    photo_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One photo per checkpoint per booking (start / halfway / end) — supports upsert on re-capture.
    CONSTRAINT booking_checkins_one_per_type UNIQUE (booking_id, type)
);
CREATE INDEX idx_checkins_booking ON booking_checkins (booking_id);

-- ============================================================
-- MESSAGES  (threaded per booking)
-- ============================================================
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_booking ON messages (booking_id, created_at);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    reviewer_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    reviewee_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_id, reviewer_id)
);
CREATE INDEX idx_reviews_reviewee ON reviews (reviewee_id);

-- ============================================================
-- POINTS  (ledger), STREAKS, REWARDS
-- ============================================================
CREATE TABLE points (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    delta       INT NOT NULL,            -- + earned / - redeemed
    reason      TEXT NOT NULL,
    booking_id  UUID REFERENCES bookings (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_points_user ON points (user_id, created_at);

CREATE TABLE streaks (
    walker_id       UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    current_streak  INT NOT NULL DEFAULT 0,
    longest_streak  INT NOT NULL DEFAULT 0,
    last_activity   DATE
);

CREATE TABLE rewards_catalog (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    description  TEXT,
    points_cost  INT NOT NULL CHECK (points_cost > 0),
    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PLATFORM PRICING CONFIG  (versioned — pricing engine inputs, planning_v2 §3, §7)
-- A new row per change; bookings pin pricing_version. Never edit a live row.
-- ============================================================
CREATE TABLE platform_pricing_config (
    version              INT PRIMARY KEY,
    -- Each config row is tied to a market/currency (Beirut-first, Gulf-ready)
    region               TEXT NOT NULL DEFAULT 'LB',  -- e.g. 'LB', 'AE', 'SA'
    currency             TEXT NOT NULL DEFAULT 'USD'
                             CHECK (currency IN ('USD', 'LBP', 'AED', 'SAR')),
    base_walk_rate       NUMERIC(10, 2) NOT NULL,     -- per hour, in `currency`
    base_sit_rate        NUMERIC(10, 2) NOT NULL,     -- per hour, in `currency`
    tier_multipliers     JSONB NOT NULL DEFAULT '{"starter":1.0,"pro":1.1,"elite":1.2}'::jsonb,

    distance_threshold_km NUMERIC(6, 2) NOT NULL DEFAULT 0,
    distance_fee_per_km  NUMERIC(10, 2) NOT NULL DEFAULT 0,

    per_pet_fee          NUMERIC(10, 2) NOT NULL DEFAULT 0,
    -- diminishing schedule: 1st incl, 2nd full, 3rd 50%, 4th+ 30%
    per_pet_diminishing  JSONB NOT NULL DEFAULT '{"1":0,"2":1.0,"3":0.5,"4plus":0.3}'::jsonb,

    food_daily_fee       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    food_daily_cap       NUMERIC(10, 2) NOT NULL DEFAULT 0,

    surge_radius_km      NUMERIC(6, 2) NOT NULL DEFAULT 5,
    surge_walker_threshold INT NOT NULL DEFAULT 3,    -- surge engages below this
    surge_max_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.5,

    pool_discount_pct    NUMERIC(4, 2) NOT NULL DEFAULT 0.20,  -- Walk Share flat discount
    platform_pct         NUMERIC(4, 2) NOT NULL DEFAULT 0.15,  -- commission
    min_wage_hourly      NUMERIC(10, 2) NOT NULL DEFAULT 0,    -- earnings floor

    effective_from       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PLATFORM CONFIG  (operational params — single live row, planning_v2 §7)
-- ============================================================
CREATE TABLE platform_config (
    id                    INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
    max_pack_size_cap     INT NOT NULL DEFAULT 4,
    max_boarding_pets_cap INT NOT NULL DEFAULT 3,
    pack_radius_km        NUMERIC(6, 2) NOT NULL DEFAULT 2,
    travel_buffer_min     INT NOT NULL DEFAULT 15,
    quote_validity_hours  INT NOT NULL DEFAULT 24,
    -- cancellation tiers: free ≥ free_cancel_hours; partial within; none once started
    free_cancel_hours     INT NOT NULL DEFAULT 24,
    late_cancel_refund_pct NUMERIC(4, 2) NOT NULL DEFAULT 0.50,
    -- walker payout is held this long after capture so the customer can dispute
    payout_review_hours   INT NOT NULL DEFAULT 24,
    -- destination handles the customer sends money to for manual Lebanese rails
    whish_number          TEXT NOT NULL DEFAULT '+961 00 000 000',
    omt_beneficiary       TEXT NOT NULL DEFAULT 'Sidelick SAL',
    bob_beneficiary       TEXT NOT NULL DEFAULT 'Sidelick SAL',
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PAYOUTS  (batched release of earnings to a walker — payments_spec §6)
-- ============================================================
CREATE TABLE payouts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    walker_id     UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    amount        NUMERIC(10, 2) NOT NULL,
    currency      TEXT NOT NULL CHECK (currency IN ('USD', 'LBP', 'AED', 'SAR')),
    method        TEXT NOT NULL CHECK (method IN ('whish', 'omt', 'bob', 'tap_destination', 'paytabs_split', 'bank', 'stripe')),
    status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    period_start  DATE,
    period_end    DATE,
    provider_ref  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_walker ON payouts (walker_id, created_at);

-- ============================================================
-- PAYMENTS  (one per booking: collect → hold → capture → payout — payments_spec §2,§6)
-- ============================================================
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id          UUID NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE RESTRICT,

    provider            TEXT NOT NULL CHECK (provider IN ('whish', 'omt', 'bob', 'tap', 'areeba', 'paytabs', 'cash', 'stripe')),
    method              TEXT NOT NULL CHECK (method IN ('card', 'cash_in', 'transfer', 'cash_on_service')),

    currency            TEXT NOT NULL CHECK (currency IN ('USD', 'LBP', 'AED', 'SAR')),
    amount              NUMERIC(10, 2) NOT NULL,           -- customer_total
    platform_commission NUMERIC(10, 2) NOT NULL DEFAULT 0,
    walker_payout       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    walker_deduction    NUMERIC(10, 2) NOT NULL DEFAULT 0,  -- docked from payout on fault-based refunds; batch releases (walker_payout - walker_deduction)
    refunded_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0,

    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'held', 'captured', 'refunded', 'failed')),
    provider_ref        TEXT,                              -- gateway txn id / manual-rail reconciliation reference
    payer_marked_paid_at TIMESTAMPTZ,                       -- customer self-reported "I sent it" on a manual rail; NULL until tapped

    payout_id           UUID REFERENCES payouts (id) ON DELETE SET NULL,  -- which payout released the walker portion
    payout_eligible_at  TIMESTAMPTZ,                        -- captured_at + review window; NULL until captured

    captured_at         TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_payout ON payments (payout_id);

-- ============================================================
-- WALKER LEDGER  (commission the walker owes the platform, e.g. cash bookings)
--   For cash-on-service the walker holds the full customer amount and owes the
--   platform its commission. A positive amount = walker owes the platform; a
--   payout batch nets outstanding entries against the walker's online earnings.
-- ============================================================
CREATE TABLE walker_ledger (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    walker_id   UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    booking_id  UUID REFERENCES bookings (id) ON DELETE SET NULL,
    entry_type  TEXT NOT NULL CHECK (entry_type IN ('cash_commission_due', 'payout_offset', 'adjustment')),
    amount      NUMERIC(10, 2) NOT NULL,   -- positive = walker owes platform; negative = credit
    currency    TEXT NOT NULL CHECK (currency IN ('USD', 'LBP', 'AED', 'SAR')),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_walker_ledger_walker ON walker_ledger (walker_id, created_at);
CREATE UNIQUE INDEX uq_walker_ledger_cash_commission
  ON walker_ledger (booking_id) WHERE entry_type = 'cash_commission_due';

-- ============================================================
-- DISPUTES  (trust & safety: customer-raised problem with a booking)
--   Capture happens on completion, but the walker payout is held for
--   platform_config.payout_review_hours; an OPEN dispute pauses payout until an
--   admin resolves it (full/partial refund or denied). Integrity flags on the
--   booking (ended_early / missed_mid_photo) are review inputs, not auto-refunds.
-- ============================================================
CREATE TABLE disputes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id    UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    opened_by     UUID NOT NULL REFERENCES users (id) ON DELETE SET NULL,

    reason        TEXT NOT NULL CHECK (reason IN (
                      'ended_early', 'missing_photos', 'no_show',
                      'pet_welfare', 'other'
                  )),
    note          TEXT,

    status        TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'resolved', 'rejected')),

    resolution    TEXT CHECK (resolution IN ('refund_full', 'refund_partial', 'denied')),
    refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    walker_liable BOOLEAN NOT NULL DEFAULT true,  -- true = refund docked from walker payout; false = platform goodwill, walker paid in full
    resolved_by   UUID REFERENCES users (id) ON DELETE SET NULL,
    resolved_at   TIMESTAMPTZ,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- At most one OPEN dispute per booking (resolved/rejected ones can coexist).
CREATE UNIQUE INDEX uq_disputes_open_per_booking ON disputes (booking_id) WHERE status = 'open';
CREATE INDEX idx_disputes_status ON disputes (status, created_at);

-- ============================================================
-- NOTIFICATIONS  (in-app bell history; Socket.IO pushes the same row live)
-- ============================================================
CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,  -- recipient

    type        TEXT NOT NULL CHECK (type IN (
                    'booking_requested', 'booking_accepted', 'booking_declined',
                    'booking_cancelled', 'booking_expired', 'walk_started', 'walk_completed',
                    'review_received', 'payment_received', 'promo',
                    'dispute_opened', 'dispute_resolved'
                )),
    title       TEXT NOT NULL,
    body        TEXT,

    booking_id  UUID REFERENCES bookings (id) ON DELETE SET NULL,       -- click-through target
    data        JSONB NOT NULL DEFAULT '{}'::jsonb,

    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user   ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id) WHERE read_at IS NULL;

-- ============================================================
-- PUSH SUBSCRIPTIONS  (Web Push — closed-app notifications)
-- One row per browser/device. endpoint is the unique push target;
-- p256dh + auth are the Push API encryption keys. Pruned when the push
-- service reports the subscription is gone (404/410).
-- ============================================================
CREATE TABLE push_subscriptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    endpoint     TEXT NOT NULL UNIQUE,
    p256dh       TEXT NOT NULL,
    auth         TEXT NOT NULL,
    user_agent   TEXT,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_subs_user ON push_subscriptions (user_id);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pets_updated      BEFORE UPDATE ON pets      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated  BEFORE UPDATE ON bookings  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_config_updated    BEFORE UPDATE ON platform_config FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated  BEFORE UPDATE ON payments  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payouts_updated   BEFORE UPDATE ON payouts   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_disputes_updated  BEFORE UPDATE ON disputes  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
