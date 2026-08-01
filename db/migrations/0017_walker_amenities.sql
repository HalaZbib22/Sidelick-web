-- 0017_walker_amenities.sql
-- Structured walker skills & amenities (fixed taxonomy, validated in code).
-- Stored as a JSONB string array, like service_types. GIN-indexed so the
-- discovery filter (amenities @> '["first-aid-cpr", ...]') stays fast.
-- Taxonomy lives in frontend/lib/amenities.ts + backend/src/lib/amenities.ts.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS amenities JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_amenities
    ON users USING GIN (amenities jsonb_path_ops);
