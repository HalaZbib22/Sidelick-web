-- ============================================================
-- 0006 RECURRING BOOKINGS
-- A "series" captures the recurrence rule; each occurrence is a normal
-- bookings row linked back via series_id, so the entire per-booking
-- lifecycle (accept / start / photos / complete / review) is unchanged.
-- ============================================================

CREATE TABLE IF NOT EXISTS booking_series (
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
CREATE INDEX IF NOT EXISTS idx_series_customer ON booking_series (customer_id);
CREATE INDEX IF NOT EXISTS idx_series_walker   ON booking_series (walker_id);

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS series_id    UUID REFERENCES booking_series (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS series_index INT;

CREATE INDEX IF NOT EXISTS idx_bookings_series ON bookings (series_id, series_index);
