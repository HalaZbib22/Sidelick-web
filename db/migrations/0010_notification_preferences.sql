-- 0010_notification_preferences.sql
-- Per-category notification preferences. Users can mute whole categories of
-- notifications; the notify() choke point checks these before persisting or
-- pushing, so a muted category produces no bell entry and no Web Push.
--
-- Categories (the notification `type` maps onto exactly one):
--   booking_updates -> booking_requested/accepted/declined/cancelled,
--                      walk_started/completed, payment_received
--   reviews         -> review_received
--   reminders       -> booking_expired, promo
--
-- Stored as JSONB (matching service_types) so new categories are additive
-- without a schema change. Absent keys are treated as enabled (opt-out model).
ALTER TABLE users
  ADD COLUMN notification_prefs JSONB NOT NULL
  DEFAULT '{"booking_updates": true, "reviews": true, "reminders": true}'::jsonb;
