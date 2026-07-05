-- Adds selfie + liveness/provider fields to walker verification.
-- Manual face-match for the pilot; provider columns ready for automated IDV later.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_doc_type     TEXT
    CHECK (verification_doc_type IN ('national_id', 'drivers_license', 'passport')),
  ADD COLUMN IF NOT EXISTS verification_selfie_url   TEXT,
  ADD COLUMN IF NOT EXISTS verification_provider     TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS verification_result       JSONB,
  ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;
