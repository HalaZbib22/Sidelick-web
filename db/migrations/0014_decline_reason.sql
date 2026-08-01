-- Capture WHY a walker/sitter declined a request.
--   decline_reason: structured code for analytics/triage (matches the enum in
--                   backend/src/routes/bookings.ts declineSchema).
--   decline_note:   optional free-text context (walker's own words).
-- Internal only — the owner never sees the reason verbatim; they get a neutral
-- "not available" message and are steered to other walkers.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS decline_reason TEXT
    CHECK (decline_reason IN (
      'unavailable', 'too_far', 'dog_fit', 'too_many_dogs',
      'special_needs', 'uncomfortable', 'other'
    )),
  ADD COLUMN IF NOT EXISTS decline_note TEXT;
