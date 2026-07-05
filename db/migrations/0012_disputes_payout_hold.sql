-- 0012_disputes_payout_hold.sql
-- Trust & safety: capture on completion, but protect the customer with a payout
-- review window + a structured dispute, instead of auto-judging on the integrity
-- flags (ended_early / missed_mid_photo). Rationale (product decision):
--   * A charge is captured when the walk completes (money leaves the customer).
--   * The walker's PAYOUT is held for `payout_review_hours` after capture. A batch
--     payout run may only release a payment once payout_eligible_at has passed AND
--     no dispute is open — so a customer always has a window to flag a bad walk.
--   * Early-finish / missing-photo flags are INPUTS to a dispute/admin review, not
--     automatic refunds — honest walkers aren't punished for a camera-shy dog.

-- How long after capture the walker's payout is held for possible dispute.
ALTER TABLE platform_config
  ADD COLUMN IF NOT EXISTS payout_review_hours INT NOT NULL DEFAULT 24;

-- When the walker's portion of this payment becomes eligible for a payout batch.
-- Set at capture time (captured_at + review window). NULL until captured.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payout_eligible_at TIMESTAMPTZ;

-- A customer-raised (or admin-raised) problem with a booking. One OPEN dispute
-- per booking at a time; resolution decides any refund and unblocks payout.
CREATE TABLE IF NOT EXISTS disputes (
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

    -- Filled at resolution by an admin.
    resolution    TEXT CHECK (resolution IN ('refund_full', 'refund_partial', 'denied')),
    refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    resolved_by   UUID REFERENCES users (id) ON DELETE SET NULL,
    resolved_at   TIMESTAMPTZ,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one OPEN dispute per booking (resolved/rejected ones can coexist).
CREATE UNIQUE INDEX IF NOT EXISTS uq_disputes_open_per_booking
    ON disputes (booking_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes (status, created_at);

-- Keep updated_at fresh on edits (same trigger fn the other tables use).
DROP TRIGGER IF EXISTS trg_disputes_updated ON disputes;
CREATE TRIGGER trg_disputes_updated
    BEFORE UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- New notification types for the dispute lifecycle.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
      'booking_requested', 'booking_accepted', 'booking_declined',
      'booking_cancelled', 'booking_expired', 'walk_started', 'walk_completed',
      'review_received', 'payment_received', 'promo',
      'dispute_opened', 'dispute_resolved'
  ));
