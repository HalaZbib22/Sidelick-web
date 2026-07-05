-- Seed a default pricing config (Lebanon / USD) + the singleton platform config,
-- so the pricing engine has rates to quote with. Tunable later via admin.

INSERT INTO platform_pricing_config (
  version, region, currency,
  base_walk_rate, base_sit_rate, tier_multipliers,
  distance_threshold_km, distance_fee_per_km,
  per_pet_fee, per_pet_diminishing,
  food_daily_fee, food_daily_cap,
  surge_radius_km, surge_walker_threshold, surge_max_multiplier,
  pool_discount_pct, platform_pct, min_wage_hourly
) VALUES (
  1, 'LB', 'USD',
  12.00, 8.00, '{"starter":1.0,"pro":1.1,"elite":1.2}',
  2, 1.50,
  5.00, '{"1":0,"2":1.0,"3":0.5,"4plus":0.3}',
  5.00, 15.00,
  5, 3, 1.5,
  0.20, 0.15, 4.00
) ON CONFLICT (version) DO NOTHING;

INSERT INTO platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
