-- Walk/sit time tracking + integrity.
-- Records when the walker actually started and finished, and flags bookings
-- completed meaningfully short of the booked duration (anti-fraud signal).
-- The ended_early flag is the groundwork for admin enforcement (alerts /
-- on-the-spot photo requests / strikes) added later.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_early     BOOLEAN NOT NULL DEFAULT false;

-- Lets admins quickly pull flagged completions for review.
CREATE INDEX IF NOT EXISTS idx_bookings_ended_early
  ON bookings (walker_id) WHERE ended_early;
