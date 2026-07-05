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
CREATE TABLE bookings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    walker_id           UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    service_type        TEXT NOT NULL CHECK (service_type IN ('walk', 'sit', 'walk_sit')),
    status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'requested', 'accepted',
                                              'in_progress', 'completed', 'declined', 'cancelled')),

    -- Overall span (derived from segments; stored for range queries)
    start_at            TIMESTAMPTZ,
    end_at              TIMESTAMPTZ,

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
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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
    method        TEXT NOT NULL CHECK (method IN ('whish', 'omt', 'tap_destination', 'paytabs_split', 'bank')),
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

    provider            TEXT NOT NULL CHECK (provider IN ('whish', 'omt', 'tap', 'areeba', 'paytabs', 'cash')),
    method              TEXT NOT NULL CHECK (method IN ('card', 'cash_in', 'transfer', 'cash_on_service')),

    currency            TEXT NOT NULL CHECK (currency IN ('USD', 'LBP', 'AED', 'SAR')),
    amount              NUMERIC(10, 2) NOT NULL,           -- customer_total
    platform_commission NUMERIC(10, 2) NOT NULL DEFAULT 0,
    walker_payout       NUMERIC(10, 2) NOT NULL DEFAULT 0,
    refunded_amount     NUMERIC(10, 2) NOT NULL DEFAULT 0,

    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'held', 'captured', 'refunded', 'failed')),
    provider_ref        TEXT,                              -- gateway txn id / OMT reference

    payout_id           UUID REFERENCES payouts (id) ON DELETE SET NULL,  -- which payout released the walker portion

    captured_at         TIMESTAMPTZ,
    refunded_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_payout ON payments (payout_id);

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
