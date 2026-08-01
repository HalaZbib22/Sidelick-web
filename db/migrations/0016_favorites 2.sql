-- 0016_favorites.sql
-- Favorites / bookmarking of walkers by pet owners.
-- One row per (owner, walker) pair; unfavoriting deletes the row.
-- Surfaced as a heart on walker cards + a one-tap save prompt after
-- a 4-5 star review. Favorites float to the top of walker search.

CREATE TABLE IF NOT EXISTS favorites (
    user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,  -- the owner who saved
    walker_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,  -- the saved walker
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, walker_id),
    CONSTRAINT no_self_favorite CHECK (user_id <> walker_id)
);

-- "Who favorited this walker" lookups (future: favorite counts on profiles).
CREATE INDEX IF NOT EXISTS idx_favorites_walker ON favorites (walker_id);
