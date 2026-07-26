-- 0020_service_debriefs.sql
-- Walker-side post-service debrief. Internal only (admins see it; owners never
-- do). Structured categorical answers for analytics + an optional note.
-- One row per booking; a skip is recorded too so the walker isn't re-prompted.

CREATE TABLE IF NOT EXISTS service_debriefs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id          UUID NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE CASCADE,
    walker_id           UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    skipped             BOOLEAN NOT NULL DEFAULT false,

    -- All null when skipped; all set when submitted (enforced in code).
    overall             INT CHECK (overall BETWEEN 1 AND 5),
    pet_as_described    TEXT CHECK (pet_as_described IN ('yes', 'mostly', 'no')),
    owner_communication TEXT CHECK (owner_communication IN ('great', 'fine', 'difficult')),
    handoff             TEXT CHECK (handoff IN ('smooth', 'minor_issues', 'problematic')),
    work_again          TEXT CHECK (work_again IN ('yes', 'maybe', 'no')),
    note                TEXT CHECK (char_length(note) <= 1000),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_debriefs_walker  ON service_debriefs (walker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_debriefs_created ON service_debriefs (created_at DESC);
