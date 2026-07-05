-- ============================================================
-- 0007 NOTIFICATIONS
-- One row per delivered notification. Persisted so the bell shows
-- history + unread count across sessions; Socket.IO pushes the same
-- payload live when the recipient is connected.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,  -- recipient

    type        TEXT NOT NULL CHECK (type IN (
                    'booking_requested', 'booking_accepted', 'booking_declined',
                    'booking_cancelled', 'walk_started', 'walk_completed',
                    'review_received', 'payment_received', 'promo'
                )),
    title       TEXT NOT NULL,
    body        TEXT,

    booking_id  UUID REFERENCES bookings (id) ON DELETE SET NULL,       -- click-through target
    data        JSONB NOT NULL DEFAULT '{}'::jsonb,

    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id, created_at DESC);

-- Fast unread-count lookups for the bell badge.
CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (user_id) WHERE read_at IS NULL;
