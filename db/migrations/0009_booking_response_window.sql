-- 0009_booking_response_window.sql
-- Unanswered-request handling. A requested booking the walker never accepts or
-- declines should not sit forever: respond_by is the deadline, after which a
-- background sweeper flips it to 'expired' and nudges the customer toward
-- another walker.

-- 1. Deadline by which the walker must accept/decline. Set at request time to
--    least(created_at + response window, start_at). NULL for pre-existing rows.
ALTER TABLE bookings ADD COLUMN respond_by TIMESTAMPTZ;

-- 2. New terminal status for requests that timed out without a response.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('draft', 'requested', 'accepted', 'in_progress',
                      'completed', 'declined', 'cancelled', 'expired'));

-- 3. Lets the sweeper find due requests cheaply.
CREATE INDEX idx_bookings_respond_by ON bookings (respond_by)
    WHERE status = 'requested';

-- 4. New notification type for the "no response — here are alternatives" nudge.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'booking_requested', 'booking_accepted', 'booking_declined',
        'booking_cancelled', 'booking_expired', 'walk_started', 'walk_completed',
        'review_received', 'payment_received', 'promo'
    ));
