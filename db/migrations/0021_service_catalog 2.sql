-- 0021_service_catalog.sql
-- The four-way service catalog (roadmap phase 4):
--   walk | daycare | boarding | drop_in
-- Replaces the coarse walk|sit split. Existing data migrates:
--   * bookings/segments 'sit' -> 'boarding' (sit was "overnight at walker's home")
--   * walkers offering 'sit'  -> 'daycare' + 'boarding' (the old card literally
--     said "Daycare & overnight at your home")
--   * 'walk_sit' combo bookings stay as legacy rows (no new ones are created)
-- Pricing config is immutable per version: new unit rates land as version 2.

-- 1) Expand booking service types (legacy 'sit'/'walk_sit' stay valid for old rows).
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_type_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_service_type_check
    CHECK (service_type IN ('walk', 'daycare', 'boarding', 'drop_in', 'sit', 'walk_sit'));

ALTER TABLE booking_segments DROP CONSTRAINT IF EXISTS booking_segments_segment_type_check;
ALTER TABLE booking_segments ADD CONSTRAINT booking_segments_segment_type_check
    CHECK (segment_type IN ('walk', 'daycare', 'boarding', 'drop_in', 'sit'));

-- 2) Backfill: sit was overnight care at the walker's home = boarding.
UPDATE bookings         SET service_type = 'boarding' WHERE service_type = 'sit';
UPDATE booking_segments SET segment_type = 'boarding' WHERE segment_type = 'sit';

-- 3) Walkers who offered 'sit' now offer daycare + boarding.
UPDATE users
   SET service_types = (service_types - 'sit') || '["daycare","boarding"]'::jsonb
 WHERE service_types ? 'sit';

-- 4) Per-unit rates for the new services. Columns first...
ALTER TABLE platform_pricing_config
    ADD COLUMN IF NOT EXISTS base_daycare_rate NUMERIC(10, 2),  -- per day
    ADD COLUMN IF NOT EXISTS base_boarding_rate NUMERIC(10, 2), -- per night
    ADD COLUMN IF NOT EXISTS base_drop_in_rate NUMERIC(10, 2);  -- per 30-min visit

-- ...then version 2, inheriting version 1 and adding the new unit rates.
INSERT INTO platform_pricing_config (
    version, region, currency,
    base_walk_rate, base_sit_rate, base_daycare_rate, base_boarding_rate, base_drop_in_rate,
    tier_multipliers, distance_threshold_km, distance_fee_per_km,
    per_pet_fee, per_pet_diminishing, food_daily_fee, food_daily_cap,
    surge_radius_km, surge_walker_threshold, surge_max_multiplier,
    pool_discount_pct, platform_pct, min_wage_hourly, effective_from
)
SELECT 2, region, currency,
       base_walk_rate, base_sit_rate, 20.00, 25.00, 6.00,
       tier_multipliers, distance_threshold_km, distance_fee_per_km,
       per_pet_fee, per_pet_diminishing, food_daily_fee, food_daily_cap,
       surge_radius_km, surge_walker_threshold, surge_max_multiplier,
       pool_discount_pct, platform_pct, min_wage_hourly, now()
  FROM platform_pricing_config
 WHERE version = 1
ON CONFLICT (version) DO NOTHING;
