-- Live walk/sit photos: one at start, one halfway ('during'), one at end.
-- Reuses the pre-existing booking_checkins table (type start/during/end, photo_url).
-- Anti-fraud: photo_url holds a private:// ref, created_at is the server timestamp
-- the walker can't forge. The start photo gates starting the walk and the end
-- photo gates completing it (enforced in the API); the halfway photo is prompted
-- and its absence is recorded via bookings.missed_mid_photo for admin review.

-- One photo per checkpoint per booking, so we can upsert on re-capture.
ALTER TABLE booking_checkins
  ADD CONSTRAINT booking_checkins_one_per_type UNIQUE (booking_id, type);

-- Flag set at completion when no halfway ('during') photo was ever captured.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS missed_mid_photo BOOLEAN NOT NULL DEFAULT false;

-- Lets admins pull bookings missing the halfway photo for review.
CREATE INDEX IF NOT EXISTS idx_bookings_missed_mid_photo
  ON bookings (walker_id) WHERE missed_mid_photo;
