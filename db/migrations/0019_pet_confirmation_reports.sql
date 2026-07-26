-- 0019_pet_confirmation_reports.sql
-- Two-way trust loop (roadmap: pet confirmation + walker-filed pet reports).
-- 1) Walkers confirm at handoff that the pet matches its profile.
-- 2) Walkers can report profile inaccuracies (undisclosed behavior/health,
--    wrong pet, etc.) — reviewed by admins, mirroring the disputes flow.

-- One timestamp per booking: when the walker confirmed the pets at handoff.
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS pets_confirmed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS pet_reports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id   UUID NOT NULL REFERENCES bookings (id) ON DELETE CASCADE,
    pet_id       UUID NOT NULL REFERENCES pets (id) ON DELETE CASCADE,
    reporter_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,  -- the walker

    category     TEXT NOT NULL CHECK (category IN (
                     'profile_mismatch',      -- pet doesn't match its profile (breed/size/photo)
                     'behavior_undisclosed',  -- aggression / behavior issues not disclosed
                     'health_undisclosed',    -- medical condition not disclosed
                     'wrong_pet',             -- a different pet than the one booked
                     'other'
                 )),
    note         TEXT CHECK (char_length(note) <= 1000),

    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
    admin_note   TEXT CHECK (char_length(admin_note) <= 1000),

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ
);

-- One open report per pet per booking.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pet_reports_open
    ON pet_reports (booking_id, pet_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_pet_reports_status ON pet_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pet_reports_pet    ON pet_reports (pet_id);

-- New notification type for the reporter when an admin reviews their report.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'booking_requested', 'booking_accepted', 'booking_declined',
    'booking_cancelled', 'booking_expired', 'walk_started', 'walk_completed',
    'review_received', 'payment_received', 'promo',
    'dispute_opened', 'dispute_resolved', 'pet_report_reviewed'
));
