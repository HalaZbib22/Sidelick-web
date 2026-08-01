import { query } from "./db.js";

/**
 * Canonical pricing engine. Server-authoritative.
 * Four-way catalog: walk (per hour, prorated) · daycare (per day) ·
 * boarding (per night) · drop-in (per 30-min visit).
 */
export type CatalogService = "walk" | "daycare" | "boarding" | "drop_in";

export interface QuoteInput {
  serviceType: CatalogService;
  walkDurationMinutes?: number; // walk
  daycareDays?: number;         // daycare
  boardingNights?: number;      // boarding
  dropInMinutes?: number;       // drop_in (30 or 60)
  petCount: number;
  foodDays?: number;            // boarding add-on
  distanceKm?: number;
  isSharedWalk?: boolean;       // walk only
  tier?: string | null;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  currency: string;
  lines: QuoteLine[]; // customer-facing
  total: number;
  pricingVersion: number;
  walkerPayout: number; // internal — never shown to customers
}

const round = (n: number) => Math.round(n * 100) / 100;

function formatDur(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} hr` : `${minutes} min`;
}

// Diminishing per-pet fee for pets beyond the first.
function perPetFee(fee: number, sched: Record<string, number>, n: number): number {
  let total = 0;
  for (let i = 2; i <= n; i++) {
    const key = i <= 3 ? String(i) : "4plus";
    const mult = sched[key] ?? sched["4plus"] ?? 0;
    total += fee * mult;
  }
  return total;
}

interface PricingConfigRow {
  version: number;
  currency: string;
  base_walk_rate: string;
  base_sit_rate: string; // legacy (pre-catalog)
  base_daycare_rate: string | null;
  base_boarding_rate: string | null;
  base_drop_in_rate: string | null;
  tier_multipliers: Record<string, number>;
  distance_threshold_km: string;
  distance_fee_per_km: string;
  per_pet_fee: string;
  per_pet_diminishing: Record<string, number>;
  food_daily_fee: string;
  food_daily_cap: string;
  pool_discount_pct: string;
  platform_pct: string;
  min_wage_hourly: string;
}

export async function computeQuote(input: QuoteInput): Promise<Quote | null> {
  const r = await query<PricingConfigRow>(
    `SELECT * FROM platform_pricing_config WHERE region = 'LB' ORDER BY version DESC LIMIT 1`
  );
  const c = r.rows[0];
  if (!c) return null;

  const tierMult = (input.tier && c.tier_multipliers?.[input.tier]) || 1;
  const lines: QuoteLine[] = [];
  let subtotal = 0;

  if (input.serviceType === "walk") {
    const mins = input.walkDurationMinutes ?? 60;
    let walkBase = Number(c.base_walk_rate) * tierMult * (mins / 60);
    lines.push({ label: `Walk (${formatDur(mins)})`, amount: round(walkBase) });
    if (input.isSharedWalk) {
      const disc = walkBase * Number(c.pool_discount_pct);
      walkBase -= disc;
      lines.push({ label: `Walk Share (−${Math.round(Number(c.pool_discount_pct) * 100)}%)`, amount: -round(disc) });
    }
    subtotal += walkBase;
  }

  if (input.serviceType === "daycare") {
    const days = input.daycareDays ?? 1;
    const base = Number(c.base_daycare_rate ?? c.base_sit_rate) * tierMult * days;
    lines.push({ label: `Daycare (${days} day${days > 1 ? "s" : ""})`, amount: round(base) });
    subtotal += base;
  }

  if (input.serviceType === "boarding") {
    const nights = input.boardingNights ?? 1;
    const base = Number(c.base_boarding_rate ?? c.base_sit_rate) * tierMult * nights;
    lines.push({ label: `Boarding (${nights} night${nights > 1 ? "s" : ""})`, amount: round(base) });
    subtotal += base;
    if (input.foodDays && input.foodDays > 0) {
      const food = Math.min(Number(c.food_daily_fee), Number(c.food_daily_cap)) * input.foodDays;
      lines.push({ label: `Food handling (${input.foodDays} day${input.foodDays > 1 ? "s" : ""})`, amount: round(food) });
      subtotal += food;
    }
  }

  if (input.serviceType === "drop_in") {
    const mins = input.dropInMinutes ?? 30;
    const base = Number(c.base_drop_in_rate ?? c.base_sit_rate) * tierMult * (mins / 30);
    lines.push({ label: `Drop-in visit (${formatDur(mins)})`, amount: round(base) });
    subtotal += base;
  }

  if (input.distanceKm && input.distanceKm > Number(c.distance_threshold_km)) {
    let dist = input.distanceKm * Number(c.distance_fee_per_km);
    if (input.isSharedWalk) dist *= 0.5; // shared route
    lines.push({ label: `Distance (${input.isSharedWalk ? "shared, " : ""}${round(input.distanceKm)} km)`, amount: round(dist) });
    subtotal += dist;
  }

  const pets = perPetFee(Number(c.per_pet_fee), c.per_pet_diminishing, input.petCount);
  if (pets > 0) {
    lines.push({ label: `Additional pets (${input.petCount})`, amount: round(pets) });
    subtotal += pets;
  }

  // Surge: dynamic availability-based surge is not enabled in v1 (multiplier = 1).
  const servicePrice = subtotal;
  const total = round(servicePrice);

  // Commission + minimum-earnings (internal; not shown to the customer).
  // The hourly floor applies to time-based services (walk, drop-in); day/night
  // services are priced per unit well above hourly minimums.
  const hours =
    (input.walkDurationMinutes ?? 0) / 60 + (input.dropInMinutes ?? 0) / 60;
  let walkerPayout = servicePrice * (1 - Number(c.platform_pct));
  const floor = Number(c.min_wage_hourly) * hours;
  if (walkerPayout < floor) walkerPayout = Math.min(floor, servicePrice);

  return { currency: c.currency, lines, total, pricingVersion: c.version, walkerPayout: round(walkerPayout) };
}
