-- 0018_multi_species.sql
-- Cats join the platform (roadmap phase 3).
-- pets.species: what the pet is (default keeps existing rows valid as dogs).
-- users.accepted_species: which species a walker cares for (walker-only field).
-- Rules enforced in code: walks are dogs-only; a booking's pets must all be
-- accepted by the walker (backend-side, like verification gating).

ALTER TABLE pets
    ADD COLUMN IF NOT EXISTS species TEXT NOT NULL DEFAULT 'dog'
        CHECK (species IN ('dog', 'cat'));

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS accepted_species JSONB NOT NULL DEFAULT '["dog"]'::jsonb;

-- Discovery filter: accepted_species @> '["cat"]'
CREATE INDEX IF NOT EXISTS idx_users_accepted_species
    ON users USING GIN (accepted_species jsonb_path_ops);
