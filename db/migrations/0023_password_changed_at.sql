-- 0023_password_changed_at.sql
-- Session invalidation on password change (security hardening).
-- requireAuth rejects JWTs issued before this timestamp, so a stolen token
-- dies the moment the user resets their password.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
